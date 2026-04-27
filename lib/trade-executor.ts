/**
 * Paper Trading Executor
 *
 * Takes a TradeDecision from the LLM and executes it against the current
 * ModelState using next-open fill prices (current close ± slippage).
 * Writes updated state + trades back to Redis.
 */

import type { RedisClientType } from "redis";
import { ModelState, Trade, Position, Order } from "@/types/global";
import { modelStateKey, modelTradesKey } from "@/lib/run-redis-keys";
import { getQuote } from "@/lib/get-quotes";
import { logger } from "@/lib/logger";

const STARTING_CAPITAL = 1_000_000;
const BROKERAGE_BPS    = 10;
const SLIPPAGE_BPS     = 5;
const MAX_POSITIONS    = 10;
const MAX_POSITION_PCT = 0.20; // 20% of NAV

export type ExecutionResult = {
    updatedState: ModelState;
    executedTrades: Trade[];
    skipped: { symbol: string; reason: string }[];
};

export async function executeOrders(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: RedisClientType<any, any, any>,
    runId: string,
    state: ModelState,
    orders: Order[],
    /** Map from whatever the LLM used as "symbol" → mbCode */
    symbolToMbCode: Map<string, string>
): Promise<ExecutionResult> {
    // Deep clone state — never mutate the input
    const s: ModelState = JSON.parse(JSON.stringify(state));
    const executed: Trade[] = [];
    const skipped: { symbol: string; reason: string }[] = [];

    for (const order of orders) {
        if (order.action === "HOLD") continue;

        // ── Resolve mbCode ───────────────────────────────────────────────────
        const mbCode = symbolToMbCode.get(order.symbol) ?? order.symbol;
        const displaySymbol = order.symbol;

        // ── Current price from quote cache (derived from OHLC last candle) ────
        const quote = await getQuote(client, mbCode);
        const currentPrice = quote?.close ?? null;
        if (!currentPrice) {
            const msg = `No OHLC price data for ${displaySymbol} [${mbCode}]`;
            logger.warn("executeOrders:", msg, "— skipping.");
            skipped.push({ symbol: displaySymbol, reason: msg });
            continue;
        }

        const qty = Math.floor(Math.abs(order.quantity));
        if (qty === 0) {
            skipped.push({ symbol: displaySymbol, reason: "Quantity is 0" });
            continue;
        }

        // ── BUY ──────────────────────────────────────────────────────────────
        if (order.action === "BUY") {
            const fillPrice = currentPrice * (1 + SLIPPAGE_BPS / 10_000);
            const tradeValue = qty * fillPrice;
            const brokerage  = tradeValue * (BROKERAGE_BPS / 10_000);
            const totalCost  = tradeValue + brokerage;

            if (totalCost > s.cash) {
                const msg = `Insufficient cash (need ₹${totalCost.toFixed(0)}, have ₹${s.cash.toFixed(0)})`;
                logger.warn(`executeOrders: BUY ${displaySymbol}:`, msg);
                skipped.push({ symbol: displaySymbol, reason: msg });
                continue;
            }

            if (tradeValue > s.nav * MAX_POSITION_PCT) {
                const msg = `Exceeds 20% NAV cap (value ₹${tradeValue.toFixed(0)}, cap ₹${(s.nav * MAX_POSITION_PCT).toFixed(0)})`;
                logger.warn(`executeOrders: BUY ${displaySymbol}:`, msg);
                skipped.push({ symbol: displaySymbol, reason: msg });
                continue;
            }

            const existingIdx = s.positions.findIndex((p) => p.mbCode === mbCode);
            if (existingIdx >= 0) {
                // Add to existing position (average down/up)
                const ex = s.positions[existingIdx];
                const newQty = ex.quantity + qty;
                const newAvg = (ex.quantity * ex.avgPrice + qty * fillPrice) / newQty;
                s.positions[existingIdx] = {
                    ...ex,
                    quantity:     newQty,
                    avgPrice:     newAvg,
                    currentPrice: fillPrice,
                    pnl:          newQty * (fillPrice - newAvg),
                    pnlPct:       (fillPrice - newAvg) / newAvg,
                };
            } else {
                if (s.positions.length >= MAX_POSITIONS) {
                    const msg = `Max ${MAX_POSITIONS} positions reached`;
                    logger.warn(`executeOrders: BUY ${displaySymbol}:`, msg);
                    skipped.push({ symbol: displaySymbol, reason: msg });
                    continue;
                }
                s.positions.push({
                    symbol: displaySymbol,
                    mbCode,
                    quantity:     qty,
                    avgPrice:     fillPrice,
                    currentPrice: fillPrice,
                    pnl:          0,
                    pnlPct:       0,
                } as Position);
            }

            s.cash -= totalCost;
            s.metrics.turnoverCost = (s.metrics.turnoverCost ?? 0) + brokerage / STARTING_CAPITAL;
            executed.push({
                tradeId: `${Date.now()}-${mbCode}-BUY`,
                date:    new Date().toISOString(),
                symbol:  displaySymbol,
                mbCode,
                side:    "BUY",
                quantity: qty,
                price:    fillPrice,
                value:    totalCost,
                reason:   order.rationale,
            });
            logger.info(`executeOrders: BUY  ${displaySymbol} qty=${qty} @ ₹${fillPrice.toFixed(2)} cost=₹${totalCost.toFixed(0)}`);

        // ── SELL ─────────────────────────────────────────────────────────────
        } else if (order.action === "SELL") {
            const existingIdx = s.positions.findIndex(
                (p) => p.mbCode === mbCode || p.symbol === displaySymbol
            );
            if (existingIdx < 0) {
                const msg = "No existing position to sell";
                logger.warn(`executeOrders: SELL ${displaySymbol}:`, msg);
                skipped.push({ symbol: displaySymbol, reason: msg });
                continue;
            }

            const ex = s.positions[existingIdx];
            const sellQty    = Math.min(qty, ex.quantity);
            const fillPrice  = currentPrice * (1 - SLIPPAGE_BPS / 10_000);
            const brokerage  = sellQty * fillPrice * (BROKERAGE_BPS / 10_000);
            const proceeds   = sellQty * fillPrice - brokerage;
            const realizedPnl = sellQty * (fillPrice - ex.avgPrice) - brokerage;

            s.cash += proceeds;
            s.metrics.turnoverCost = (s.metrics.turnoverCost ?? 0) + brokerage / STARTING_CAPITAL;

            if (sellQty >= ex.quantity) {
                s.positions.splice(existingIdx, 1);
            } else {
                s.positions[existingIdx] = {
                    ...ex,
                    quantity:     ex.quantity - sellQty,
                    currentPrice: fillPrice,
                    pnl:          (ex.quantity - sellQty) * (fillPrice - ex.avgPrice),
                    pnlPct:       (fillPrice - ex.avgPrice) / ex.avgPrice,
                };
            }

            executed.push({
                tradeId: `${Date.now()}-${mbCode}-SELL`,
                date:    new Date().toISOString(),
                symbol:  displaySymbol,
                mbCode,
                side:    "SELL",
                quantity: sellQty,
                price:    fillPrice,
                value:    proceeds,
                pnl:      realizedPnl,
                reason:   order.rationale,
            });
            logger.info(`executeOrders: SELL ${displaySymbol} qty=${sellQty} @ ₹${fillPrice.toFixed(2)} pnl=₹${realizedPnl.toFixed(0)}`);
        }
    }

    // ── Recalculate NAV + metrics ────────────────────────────────────────────
    const positionValue = s.positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
    s.nav = s.cash + positionValue;

    const totalReturn = (s.nav - STARTING_CAPITAL) / STARTING_CAPITAL;
    s.metrics.totalReturn   = totalReturn;
    s.metrics.maxDrawdown   = Math.min(s.metrics.maxDrawdown ?? 0, totalReturn);
    s.metrics.numTrades     = (s.metrics.numTrades ?? 0) + executed.length;
    s.metrics.hhi           = calcHHI(s.positions);
    s.metrics.score         = totalReturn - 0.5 * Math.abs(s.metrics.maxDrawdown) - 0.1 * (s.metrics.turnoverCost ?? 0);
    s.lastUpdated           = new Date().toISOString();

    // ── Persist to Redis ─────────────────────────────────────────────────────
    await client.set(modelStateKey(runId, s.modelId), JSON.stringify(s));
    logger.info(`executeOrders: State saved — NAV ₹${s.nav.toFixed(0)}, positions=${s.positions.length}, cash=₹${s.cash.toFixed(0)}`);

    if (executed.length > 0) {
        const existingRaw = await client.get(modelTradesKey(runId, s.modelId));
        const existing: Trade[] = existingRaw ? JSON.parse(existingRaw) : [];
        await client.set(modelTradesKey(runId, s.modelId), JSON.stringify([...existing, ...executed]));
        logger.info(`executeOrders: ${executed.length} trades appended (${existing.length + executed.length} total).`);
    }

    return { updatedState: s, executedTrades: executed, skipped };
}

function calcHHI(positions: Position[]): number {
    const total = positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);
    if (total === 0) return 0;
    return positions.reduce((s, p) => {
        const w = (p.quantity * p.currentPrice) / total;
        return s + w * w;
    }, 0);
}
