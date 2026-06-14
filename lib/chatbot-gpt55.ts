/**
 * GPT-5.5 Trading Agent
 *
 * Loads model state, portfolio analytics, technicals, and news from Redis,
 * builds a structured prompt, calls GPT-5.5 via OpenAI,
 * and returns a validated TradeDecision.
 *
 * Invalid JSON → retry once → no-trade (null orders). No silent failures.
 */

import { getRedisClient } from "@/lib/redis";
import { getAIClient } from "@/lib/ai-client";
import { GPT_5_5 } from "@/lib/models";
import { getModelIdReadCandidates, normalizeModelId, normalizeRunConfig } from "@/lib/model-id";
import { logger } from "@/lib/logger";
import {
    modelStateKey,
    modelTradesKey,
    modelPfAnalyticsKey,
    runConfigKey,
} from "@/lib/run-redis-keys";
import { technicalsKey, newsKey, constituentsKey } from "@/lib/redis-keys";
import { getQuote } from "@/lib/get-quotes";
import { computePortfolioAnalytics, savePortfolioAnalytics } from "@/lib/portfolio-analytics";
import { executeOrders } from "@/lib/trade-executor";
import { ModelState, Trade, PortfolioAnalytics, RunConfig, Order, TradeDecision } from "@/types/global";

export type { Order, TradeDecision };  // re-export for convenience

const NIFTY_50_INDEX_CODE = "MBIDX70";

const NO_TRADE: TradeDecision = {
    orders: [],
    risk_controls: {},
    rationale: "No decision — invalid or missing LLM output.",
    confidence: 0,
};

const STARTING_CAPITAL = 1_000_000; // ₹10,00,000

function makeInitialState(modelId: string): ModelState {
    return {
        modelId,
        cash: STARTING_CAPITAL,
        nav: STARTING_CAPITAL,
        positions: [],
        metrics: {
            totalReturn: 0,
            maxDrawdown: 0,
            turnoverCost: 0,
            score: 0,
            hhi: 0,
            drawdownDuration: 0,
            numTrades: 0,
        },
        lastUpdated: new Date().toISOString(),
    };
}

async function readFirstModelValue(
    client: Awaited<ReturnType<typeof getRedisClient>>,
    runId: string,
    modelIds: string[],
    keyFor: (runId: string, modelId: string) => string
): Promise<{ raw: string | null; modelId: string | null }> {
    for (const modelId of modelIds) {
        const raw = await client.get(keyFor(runId, modelId));
        if (raw) return { raw, modelId };
    }
    return { raw: null, modelId: null };
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
    return `You are GPT-5.5, a disciplined quantitative portfolio manager competing in the Indian Trading Arena (Nifty 50 paper trading).

RULES:
- Universe: Nifty 50 stocks only. Use the mbCode shown in brackets as the "symbol" field in orders.
- Starting capital: ₹10,00,000. Max 10 open positions. Max 20% NAV per position. No leverage.
- Brokerage: 10 bps. Slippage: 5 bps. Execution: decision at close → fill at next open.
- Score = totalReturn − 0.5×maxDrawdown − 0.1×turnoverCost. Optimise this score.
- POSITION SIZING: Each stock's prompt shows "maxQty=N" — this is floor(NAV×0.20 / currentPrice). Never exceed it.
- Only trade stocks that have technicals or news data. Do not guess on stocks with no data.

OUTPUT FORMAT (strict JSON, no markdown, no trailing text):
{
  "orders": [
    { "symbol": "<mbCode>", "action": "BUY|SELL|HOLD", "quantity": <integer ≤ maxQty>, "rationale": "<one sentence>" }
  ],
  "risk_controls": {
    "maxNewPositions": <integer>,
    "stopLossSymbols": ["<mbCode>"],
    "profitTargetSymbols": ["<mbCode>"]
  },
  "rationale": "<2-3 sentence overall thesis>",
  "confidence": <0.0-1.0>
}

If you have no trades, return an empty orders array. Never output anything outside the JSON object.`;
}

type StockData = {
    symbol: string;       // display name (symbol or mbCode fallback)
    mbCode: string;
    held: boolean;
    currentPrice: number | null;
    priceDate: string | null;   // datetime of the quote candle
    position?: { qty: number; avgPrice: number; curPrice: number; pnl: number; pnlPct: number; mae?: number; mfe?: number };
    technicals: unknown;
    news: unknown;
};

function buildUserPrompt(
    strategy: string,
    state: ModelState,
    analytics: PortfolioAnalytics,
    stockData: StockData[]
): string {
    const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
    const inr = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    const maxQty = (price: number | null) =>
        price && price > 0 ? Math.floor((state.nav * 0.20) / price) : 0;

    // ── 1. Portfolio summary ──────────────────────────────────────────────────
    const portfolioSection = `## PORTFOLIO STATE
Strategy: ${strategy}
NAV: ${inr(state.nav)} | Cash: ${inr(state.cash)} (${pct(analytics.cashPct)}) | Exposure: ${pct(analytics.exposurePct)}
Total Return: ${pct(analytics.totalReturn)} | Max Drawdown: ${pct(analytics.maxDrawdown)} | Score: ${analytics.score.toFixed(4)}
HHI: ${analytics.hhi.toFixed(3)} | Open Positions: ${analytics.numOpenPositions}/10
Unrealized P&L: ${inr(analytics.unrealizedPnL)} (${pct(analytics.unrealizedPnLPct)})
Realized P&L: ${inr(analytics.realizedPnL)} | Win Rate: ${pct(analytics.winRate)} | Profit Factor: ${
    isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : "∞"
}
Avg MAE: ${pct(analytics.avgMAE)} | Avg MFE: ${pct(analytics.avgMFE)} | Vol Proxy: ${pct(analytics.portfolioVolatilityProxy)}`;

    // ── 2. Held stocks — HOLD / SELL / BUY MORE decision ─────────────────────
    const held = stockData.filter((s) => s.held);
    const heldSection = held.length === 0
        ? "## HELD POSITIONS\nNone — portfolio is fully in cash."
        : `## HELD POSITIONS (decide: HOLD, SELL, or BUY MORE)
${held.map((s) => {
    const p = s.position!;
    const curPx = s.currentPrice ?? p.curPrice;
    const livePnl = p.qty * (curPx - p.avgPrice);
    const livePnlPct = (curPx - p.avgPrice) / p.avgPrice;
    const mq = maxQty(curPx);
    const pxDate = s.priceDate ? ` as of ${s.priceDate.slice(0, 10)}` : "";
    const posLine = `${s.symbol} [${s.mbCode}]: qty=${p.qty} avgPx=₹${p.avgPrice.toFixed(2)} curPx=₹${curPx.toFixed(2)}${pxDate} pnl=${inr(livePnl)} (${pct(livePnlPct)}) maxQty=${mq}${p.mae !== undefined ? ` MAE=${pct(p.mae)}` : ""}${p.mfe !== undefined ? ` MFE=${pct(p.mfe)}` : ""}`;
    const techLine = s.technicals ? `  Technicals: ${JSON.stringify(s.technicals)}` : "  Technicals: not available";
    const newsLine = s.news ? `  News: ${JSON.stringify(s.news)}` : "  News: not available";
    return `${posLine}\n${techLine}\n${newsLine}`;
}).join("\n\n")}`;

    // ── 3. Universe — new BUY opportunities ───────────────────────────────────
    const universe = stockData.filter((s) => !s.held);
    const universeSection = universe.length === 0
        ? "## NIFTY 50 UNIVERSE\nNo constituent data in Redis yet."
        : `## NIFTY 50 UNIVERSE (${universe.length} stocks — find BUY opportunities)
${universe.map((s) => {
    const mq = maxQty(s.currentPrice);
    const pxDate = s.priceDate ? ` as of ${s.priceDate.slice(0, 10)}` : "";
    const priceLine = s.currentPrice
        ? `  curPx=₹${s.currentPrice.toFixed(2)}${pxDate} maxQty=${mq}`
        : "  curPx=not available — skip this stock";
    const techLine = s.technicals ? `  Technicals: ${JSON.stringify(s.technicals)}` : "  Technicals: not available";
    const newsLine = s.news ? `  News: ${JSON.stringify(s.news)}` : "  News: not available";
    return `${s.symbol} [${s.mbCode}]:\n${priceLine}\n${techLine}\n${newsLine}`;
}).join("\n\n")}`;

    return `${portfolioSection}\n\n${heldSection}\n\n${universeSection}\n\nYou MUST use technicals and news to justify every order. If a stock has no data, do not trade it. Use the mbCode as the "symbol" field in your orders. Return strict JSON only.`;
}

// ─── JSON parse with one retry ────────────────────────────────────────────────

function parseDecision(raw: string): TradeDecision | null {
    try {
        // Strip accidental markdown code fences if present
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (!Array.isArray(parsed.orders) || typeof parsed.rationale !== "string") return null;
        return parsed as TradeDecision;
    } catch {
        return null;
    }
}

// ─── Main agent function ──────────────────────────────────────────────────────

export async function runGPT55TradeDecision(
    runId: string,
    requestedModelId: string,
    strategy: string,
    options: { dryRun?: boolean } = {}
): Promise<TradeDecision> {
    const modelId = normalizeModelId(requestedModelId);
    const modelIdCandidates = getModelIdReadCandidates(modelId);
    const client = await getRedisClient();

    let state: ModelState | null = null;
    let trades: Trade[] = [];
    let analytics: PortfolioAnalytics | null = null;
    let stockData: StockData[] = [];

    try {
        const [stateResult, tradesResult, analyticsResult, cfgRaw] = await Promise.all([
            readFirstModelValue(client, runId, modelIdCandidates, modelStateKey),
            readFirstModelValue(client, runId, modelIdCandidates, modelTradesKey),
            readFirstModelValue(client, runId, modelIdCandidates, modelPfAnalyticsKey),
            client.get(runConfigKey(runId)),
        ]);
        const stateRaw = stateResult.raw;
        const tradesRaw = tradesResult.raw;
        const analyticsRaw = analyticsResult.raw;

        if (!stateRaw) {
            // Engine hasn't written state yet — boot with the initial capital so the LLM
            // can still make its first set of buy decisions.
            state = makeInitialState(modelId);
            logger.warn(`GPT-5.5: No state in Redis for ${modelId} — using fresh ₹${STARTING_CAPITAL.toLocaleString("en-IN")} starting state.`);

            // Persist so the portfolio page and subsequent runs can read it
            await client.set(modelStateKey(runId, modelId), JSON.stringify(state));

            // Also seed a minimal run config if absent
            if (!cfgRaw) {
                const { SEASON1_MODELS, ACTIVE_RUN_ID } = await import("@/config");
                const seedConfig: RunConfig = {
                    runId: ACTIVE_RUN_ID,
                    season: "Season 1",
                    status: "active",
                    startDate: new Date().toISOString().slice(0, 10),
                    universe: [],
                    models: SEASON1_MODELS.map((m) => ({ modelId: m.modelId, name: m.name, llm: "gpt-5.5", strategy: m.strategy })),
                    rules: {
                        startingCapital: STARTING_CAPITAL,
                        maxPositions: 10,
                        maxPositionSizePct: 0.2,
                        brokerageBps: 10,
                        slippageBps: 5,
                    },
                };
                await client.set(runConfigKey(runId), JSON.stringify(seedConfig));
                logger.info("GPT-5.5: Seeded run config to Redis.");
            }
        } else {
            state = JSON.parse(stateRaw) as ModelState;
            state.modelId = modelId;
            if (stateResult.modelId !== modelId) {
                await client.set(modelStateKey(runId, modelId), JSON.stringify(state));
            }
        }

        if (tradesRaw) trades = JSON.parse(tradesRaw) as Trade[];
        if (tradesRaw && tradesResult.modelId !== modelId) {
            await client.set(modelTradesKey(runId, modelId), tradesRaw);
        }
        if (analyticsRaw && analyticsResult.modelId !== modelId) {
            await client.set(modelPfAnalyticsKey(runId, modelId), analyticsRaw);
        }
        if (cfgRaw) {
            const parsedConfig: RunConfig = JSON.parse(cfgRaw);
            const config = normalizeRunConfig(parsedConfig);
            if (JSON.stringify(config.models) !== JSON.stringify(parsedConfig.models)) {
                await client.set(runConfigKey(runId), JSON.stringify(config));
            }
        }

        // Build a map of mbCode → position for quick lookup
        const positionByMbCode = new Map(state.positions.map((p) => [p.mbCode, p]));

        // Fetch all Nifty 50 constituents from Redis (mbCode list)
        const constituentRaw = await client.get(constituentsKey(NIFTY_50_INDEX_CODE));
        const allMbCodes: string[] = constituentRaw
            ? (JSON.parse(constituentRaw) as string[])
            : state.positions.map((p) => p.mbCode); // fallback: only held stocks

        if (allMbCodes.length === 0) {
            logger.warn("GPT-5.5: No Nifty 50 constituents in Redis — only held positions will be analysed.");
        } else {
            logger.info(`GPT-5.5: Fetching data for ${allMbCodes.length} constituents.`);
        }

        // Fetch technicals + news + quote for every mbCode in parallel.
        // getQuote() tries all OHLC duration keys and picks the last candle,
        // so curPx is always populated if any OHLC data exists.
        stockData = await Promise.all(
            allMbCodes.map(async (mbCode): Promise<StockData> => {
                const pos = positionByMbCode.get(mbCode);
                const [techRaw, newsRaw, quote] = await Promise.all([
                    client.get(technicalsKey(mbCode)),
                    client.get(newsKey(mbCode)),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    getQuote(client as any, mbCode),
                ]);

                const currentPrice = quote?.close ?? null;
                const priceDate    = quote?.datetime ?? null;

                return {
                    symbol: pos?.symbol ?? mbCode,
                    mbCode,
                    held: pos !== undefined,
                    currentPrice,
                    priceDate,
                    position: pos ? {
                        qty:      pos.quantity,
                        avgPrice: pos.avgPrice,
                        curPrice: currentPrice ?? pos.currentPrice,
                        pnl:      pos.pnl,
                        pnlPct:   pos.pnlPct,
                        mae:      pos.mae,
                        mfe:      pos.mfe,
                    } : undefined,
                    technicals: techRaw ? JSON.parse(techRaw) : null,
                    news:       newsRaw ? JSON.parse(newsRaw) : null,
                };
            })
        );

        const withPrice = stockData.filter((s) => s.currentPrice !== null).length;
        const withTech  = stockData.filter((s) => s.technicals !== null).length;
        const withNews  = stockData.filter((s) => s.news !== null).length;
        logger.info(`GPT-5.5: Market data — ${withPrice}/${allMbCodes.length} prices, ${withTech}/${allMbCodes.length} technicals, ${withNews}/${allMbCodes.length} news.`);

        // Enrich state positions with fresh OHLC prices before computing analytics
        // so NAV, unrealizedPnL, cashPct, etc. in the prompt reflect current market prices.
        const freshPriceByMbCode = new Map(
            stockData
                .filter((s) => s.currentPrice !== null)
                .map((s) => [s.mbCode, s.currentPrice as number])
        );
        if (freshPriceByMbCode.size > 0) {
            state.positions = state.positions.map((p) => {
                const freshPrice = freshPriceByMbCode.get(p.mbCode);
                if (!freshPrice) return p;
                const pnl    = (freshPrice - p.avgPrice) * p.quantity;
                const pnlPct = (freshPrice - p.avgPrice) / p.avgPrice;
                return { ...p, currentPrice: freshPrice, pnl, pnlPct };
            });
            state.nav =
                state.cash +
                state.positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);
        }

        // Recompute analytics with fresh prices
        analytics = computePortfolioAnalytics(runId, state, trades);
        if (!options.dryRun) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await savePortfolioAnalytics(client as any, analytics);
        }
    } finally {
        await client.disconnect();
    }

    if (!state || !analytics) return NO_TRADE;

    // Build symbol → mbCode lookup (LLM outputs mbCodes, executor needs them)
    const symbolToMbCode = new Map<string, string>(
        stockData.flatMap((s) => [
            [s.mbCode, s.mbCode],          // mbCode → mbCode (direct)
            [s.symbol, s.mbCode],           // symbol → mbCode (e.g. RELIANCE → MBEQU5710)
        ])
    );

    // Build prompt
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(strategy, state, analytics, stockData);

    const aiClient = getAIClient(GPT_5_5);

    logger.info(`GPT-5.5 trade decision request — run=${runId} model=${modelId}`);

    // Call LLM — retry once on parse failure
    let decision: TradeDecision | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await aiClient.chat.completions.create({
                model: GPT_5_5,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user",   content: userPrompt },
                ],
                response_format: { type: "json_object" },
            });

            const raw = response.choices[0]?.message?.content ?? "";
            decision = parseDecision(raw);

            if (decision) {
                logger.info(`GPT-5.5 decision ok (attempt ${attempt}) — ${decision.orders.length} orders, confidence=${decision.confidence}`);
                break;
            }

            logger.warn(`GPT-5.5 attempt ${attempt}: failed to parse JSON — raw:`, raw.slice(0, 200));
        } catch (err) {
            logger.error(`GPT-5.5 attempt ${attempt} error:`, err);
        }
    }

    if (!decision) {
        logger.warn("GPT-5.5: both attempts failed — returning no-trade.");
        return NO_TRADE;
    }

    // Execute trades and update portfolio state in Redis
    if (!options.dryRun && decision.orders.length > 0) {
        const execClient = await getRedisClient();
        try {
            const result = await executeOrders(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                execClient as any,
                runId,
                state,
                decision.orders,
                symbolToMbCode
            );
            logger.info(
                `GPT-5.5: Executed ${result.executedTrades.length} trades, skipped ${result.skipped.length}.`,
                result.skipped.length > 0 ? result.skipped : ""
            );
        } finally {
            await execClient.disconnect();
        }
    }

    return decision;
}
