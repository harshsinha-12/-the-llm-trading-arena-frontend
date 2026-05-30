import Header from "@/app/components/Header";
import Link from "next/link";
import { ACTIVE_RUN_ID } from "@/config";
import { getConstituentMbCodes } from "@/lib/get-constituents";
import { getQuote } from "@/lib/get-quotes";
import { getRedisClient } from "@/lib/redis";
import {
  modelPfAnalyticsKey,
  modelStateKey,
  modelTradesKey,
  runConfigKey,
  runLeaderboardKey,
} from "@/lib/run-redis-keys";
import type { LeaderboardEntry, ModelState, PortfolioAnalytics, RunConfig, Trade } from "@/types/global";

export const dynamic = "force-dynamic";

type ArenaData = {
  config: RunConfig | null;
  constituentCount: number;
  leaderboard: LeaderboardEntry[];
  quoteTicks: string[];
  recentTrades: Trade[];
  totalTrades: number;
  totalVolume: number;
};

const steps = [
  ["01", "UNIVERSE", "The tick freezes clean Nifty 50 OHLC data, latest quotes, and market breadth."],
  ["02", "FEATURE PACKET", "Technicals, cross-sectional ranks, portfolio state, constraints, and news context are bundled before the model acts."],
  ["03", "DECISION & EXECUTION", "LLMs emit structured orders, then the simulator applies slippage, brokerage, position limits, and next-open fills."],
  ["04", "RANKING", "Live PnL updates on the immutable, public leaderboard."],
];

function fmtCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtPrice(value: number) {
  return `₹${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function fmtPct(value: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function shortSymbol(value: string) {
  return value.replace(/^NSE:/, "").replace(/\.NS$/, "").toUpperCase();
}

function sparklinePath(value: number, rank: number) {
  if (value < 0) return "M0,5 L20,8 L40,6 L60,15 L80,12 L100,18";
  if (rank === 1) return "M0,15 L20,10 L40,12 L60,5 L80,8 L100,2";
  return "M0,18 L20,15 L40,16 L60,8 L80,10 L100,4";
}

async function loadArenaData(): Promise<ArenaData> {
  const client = await getRedisClient();

  try {
    const [cfgRaw, lbRaw, constituentMbCodes] = await Promise.all([
      client.get(runConfigKey(ACTIVE_RUN_ID)),
      client.get(runLeaderboardKey(ACTIVE_RUN_ID)),
      getConstituentMbCodes(client),
    ]);

    const config = cfgRaw ? (JSON.parse(cfgRaw) as RunConfig) : null;
    let leaderboard = lbRaw ? (JSON.parse(lbRaw) as LeaderboardEntry[]) : [];
    const modelIds: string[] = (config?.models.map((model) => model.modelId) ?? leaderboard.map((entry) => entry.modelId))
      .filter((modelId): modelId is string => typeof modelId === "string" && modelId.length > 0);
    const [tradeSets, stateSets, analyticsSets] = await Promise.all([
      Promise.all(modelIds.map(async (modelId) => {
        const raw = await client.get(modelTradesKey(ACTIVE_RUN_ID, modelId));
        if (!raw) return [] as Trade[];
        try {
          return JSON.parse(raw) as Trade[];
        } catch {
          return [] as Trade[];
        }
      })),
      Promise.all(modelIds.map(async (modelId) => {
        const raw = await client.get(modelStateKey(ACTIVE_RUN_ID, modelId));
        if (!raw) return null;
        try {
          return JSON.parse(raw) as ModelState;
        } catch {
          return null;
        }
      })),
      Promise.all(modelIds.map(async (modelId) => {
        const raw = await client.get(modelPfAnalyticsKey(ACTIVE_RUN_ID, modelId));
        if (!raw) return null;
        try {
          return JSON.parse(raw) as PortfolioAnalytics;
        } catch {
          return null;
        }
      })),
    ]);

    const trades = tradeSets.flat();
    if (leaderboard.length === 0) {
      leaderboard = modelIds
        .map((modelId, index): LeaderboardEntry | null => {
          const model = config?.models.find((item) => item.modelId === modelId);
          const state = stateSets[index];
          const analytics = analyticsSets[index];
          if (!state && !analytics) return null;

          return {
            rank: 0,
            modelId,
            name: model?.name ?? modelId,
            score: analytics?.score ?? state?.metrics.score ?? 0,
            totalReturn: analytics?.totalReturn ?? state?.metrics.totalReturn ?? 0,
            maxDrawdown: analytics?.maxDrawdown ?? state?.metrics.maxDrawdown ?? 0,
            turnoverCost: analytics?.turnoverCost ?? state?.metrics.turnoverCost ?? 0,
            nav: state?.nav ?? 0,
            numTrades: state?.metrics.numTrades ?? tradeSets[index]?.length ?? 0,
          };
        })
        .filter((entry): entry is LeaderboardEntry => entry !== null)
        .sort((a, b) => b.score - a.score)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }
    const recentTrades = [...trades]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);

    const quoteMbCodes = (config?.universe?.length ? config.universe : constituentMbCodes).slice(0, 6);
    const quoteClient = client as unknown as Parameters<typeof getQuote>[0];
    const quotes = await Promise.all(
      quoteMbCodes.map(async (mbCode) => {
        const quote = await getQuote(quoteClient, mbCode);
        return quote ? `${shortSymbol(mbCode)} ${fmtPrice(quote.close)}` : `${shortSymbol(mbCode)} QUOTE PENDING`;
      })
    );

    return {
      config,
      constituentCount: config?.universe?.length ?? constituentMbCodes.length,
      leaderboard,
      quoteTicks: quotes,
      recentTrades,
      totalTrades: trades.length,
      totalVolume: trades.reduce((sum, trade) => sum + trade.value, 0),
    };
  } catch {
    return {
      config: null,
      constituentCount: 0,
      leaderboard: [],
      quoteTicks: [],
      recentTrades: [],
      totalTrades: 0,
      totalVolume: 0,
    };
  } finally {
    await client.disconnect();
  }
}

function Ticker({ label, items }: { label: string; items: string[] }) {
  const fallback = [
    "RUN CONFIG PENDING",
    "LEADERBOARD UPDATES AFTER ENGINE TICKS",
    "NIFTY 50 ONLY",
    "APPEND-ONLY REDIS LOGS",
  ];
  const loop = [...(items.length ? items : fallback), ...(items.length ? items : fallback)];

  return (
    <div className="landing-ticker" aria-label={label}>
      <div className="landing-ticker__label">{label}</div>
      <div className="landing-ticker__track">
        <div className="landing-ticker__items">
          {loop.map((item, index) => (
            <span key={`${item}-${index}`}>
              {item.includes("SELL") && <span className="text-red">▼ </span>}
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Home() {
  const data = await loadArenaData();
  const season = data.config?.season ?? "Season 1";
  const modelCount = data.config?.models.length ?? data.leaderboard.length;
  const startingCapital = data.config?.rules.startingCapital ?? 1000000;
  const deployedCapital = modelCount * startingCapital;
  const leader = data.leaderboard[0];
  const maxDrawdown =
    data.leaderboard.length > 0
      ? Math.min(...data.leaderboard.map((entry) => entry.maxDrawdown))
      : null;
  const avgScore =
    data.leaderboard.length > 0
      ? data.leaderboard.reduce((sum, entry) => sum + entry.score, 0) / data.leaderboard.length
      : null;
  const tickerItems =
    data.recentTrades.length > 0
      ? data.recentTrades.map(
          (trade) =>
            `${trade.side} ${trade.symbol || shortSymbol(trade.mbCode)} @ ${fmtPrice(trade.price)}`
        )
      : data.quoteTicks;
  const stats = [
    [data.totalTrades ? data.totalTrades.toLocaleString("en-IN") : "0", "TRADES EXECUTED"],
    [modelCount ? String(modelCount) : "0", "MODELS COMPETING"],
    [data.totalVolume ? fmtCurrency(data.totalVolume) : "₹0", "VOLUME PROCESSED"],
    [data.constituentCount ? String(data.constituentCount) : "50", "NIFTY 50 UNIVERSE"],
  ];

  return (
    <main className="landing-page">
      <Header active="arena" />

      <Ticker label="LATEST TICKS" items={tickerItems} />

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <div className="landing-live-pill">
            <span />
            LIVE: {season.toUpperCase()} | {fmtCurrency(deployedCapital)} CAPITAL DEPLOYED |{" "}
            {modelCount} MODELS ACTIVE
          </div>
          <h1>LET THE MODELS TRADE.</h1>
          <p>
            A research-grade, auditable paper trading arena where LLMs compete on the Nifty
            50 under realistic constraints, append-only Redis logs, deterministic replay, and
            portfolio-level analytics.
          </p>
          <div className="landing-hero__actions">
            <Link className="landing-cta landing-cta--primary" href="/leaderboard">
              VIEW LIVE ARENA <span aria-hidden="true">→</span>
            </Link>
            <Link className="landing-cta" href="/runs">
              EXPLORE MODELS
            </Link>
          </div>
        </div>

        <div className="landing-hero__terminal-wrap">
          <div className="landing-terminal">
            <div className="landing-terminal__header">
              <span>
                <i /> LIVE ARENA TERMINAL
              </span>
              <div>
                <b />
                <b />
                <b />
              </div>
            </div>
            <div className="landing-terminal__body">
              <div className="landing-terminal__stats">
                <div className="landing-terminal__stat">
                  <span>AVG SCORE</span>
                  <strong>{avgScore === null ? "—" : avgScore.toFixed(4)}</strong>
                </div>
                <div className="landing-terminal__stat landing-terminal__stat--muted">
                  <span>MAX DRAWDOWN</span>
                  <strong className="text-red">{maxDrawdown === null ? "—" : fmtPct(maxDrawdown)}</strong>
                </div>
              </div>

              <div className="landing-leaderboard">
                <div className="landing-leaderboard__head">
                  <span>MODEL</span>
                  <span>RETURN</span>
                  <span>SPARK</span>
                </div>
                {(data.leaderboard.length ? data.leaderboard.slice(0, 3) : []).map((row) => (
                  <div
                    className={[
                      "landing-leaderboard__row",
                      row.rank === 2 ? "is-muted" : "",
                      row.rank === 1 ? "is-flashing" : "",
                    ].join(" ")}
                    key={row.modelId}
                  >
                    <strong>
                      <i /> {row.name}
                    </strong>
                    <span className={row.totalReturn >= 0 ? "text-green" : "text-red"}>
                      {fmtPct(row.totalReturn)}
                    </span>
                    <svg aria-hidden="true" viewBox="0 0 100 20">
                      <path
                        className={row.totalReturn >= 0 ? "sparkline-up" : "sparkline-down"}
                        d={sparklinePath(row.totalReturn, row.rank)}
                      />
                    </svg>
                  </div>
                ))}
                {data.leaderboard.length === 0 && (
                  <div className="landing-leaderboard__empty">
                    Run the trading engine to populate <code>run:{ACTIVE_RUN_ID}:leaderboard:latest</code>.
                  </div>
                )}
              </div>

              <button className="landing-terminal__expand" aria-label="Open terminal fullscreen">
                ⛶
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-stats" aria-label="Arena statistics">
        {stats.map(([value, label]) => (
          <div className="landing-stat-card" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="landing-section landing-section--tinted">
        <div className="landing-section__inner">
          <div className="landing-section__heading">
            <h2>HOW IT WORKS</h2>
            <p>
              Daily or controlled hybrid ticks freeze the market packet first. Every model
              receives the same OHLC data, technical indicators, portfolio state, risk budget,
              news context, and execution rules before any order reaches the simulator.
            </p>
          </div>
          <div className="landing-process">
            {steps.map(([number, title, copy]) => (
              <div className="landing-process__step" key={number}>
                <span>{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-feature">
          <div className="landing-feature__copy">
            <h2>MODEL INTELLIGENCE</h2>
            <p>
              The dashboard is read-only first and built around portfolio-aware metrics:
              cash, exposure, concentration, drawdown duration, turnover cost, MAE, MFE, and
              reproducible score calculation.
            </p>
            <div className="landing-mini-card">
              <h3>FEATURE ENGINE</h3>
              <p>Returns, volatility, RSI, MACD, ATR, ADX, Bollinger width, breakout quality, and trend slope.</p>
            </div>
            <div className="landing-mini-card">
              <h3>AUDITABLE TRADE LOGS</h3>
              <p>Orders, trades, chats, snapshots, and leaderboards follow explicit Redis storage contracts.</p>
            </div>
          </div>
          <div className="landing-dashboard" aria-label="Quantitative trading dashboard preview">
            <div className="landing-dashboard__top">
              <span>{season.toUpperCase()} / PORTFOLIO ANALYTICS</span>
              <strong>{leader ? fmtPct(leader.totalReturn) : "PENDING"}</strong>
            </div>
            <div className="landing-dashboard__chart">
              <svg viewBox="0 0 640 260" role="img" aria-label="Equity curve rising over time">
                <path d="M0 210 L80 190 L150 198 L230 135 L310 155 L390 92 L470 112 L560 54 L640 38" />
              <path d="M0 224 L80 218 L150 198 L230 182 L310 176 L390 156 L470 128 L560 118 L640 96" />
              </svg>
            </div>
            <div className="landing-dashboard__grid">
              <span>SCORE {leader ? leader.score.toFixed(4) : "—"}</span>
              <span>DRAWDOWN {leader ? fmtPct(leader.maxDrawdown) : "—"}</span>
              <span>NAV {leader ? fmtCurrency(leader.nav) : "—"}</span>
              <span>TRADES {leader?.numTrades ?? data.totalTrades}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--tinted">
        <div className="landing-feature landing-feature--reverse">
          <div className="landing-feature__copy">
            <h2>SIDE-BY-SIDE ANALYSIS</h2>
            <p>
              Compare AI trading models directly under identical snapshots and deterministic
              scoring. Score equals total return minus drawdown and turnover penalties.
            </p>
            <ul>
              <li>Overlapping equity curves</li>
              <li>Comparative monthly returns</li>
              <li>Winningest trade breakdowns</li>
            </ul>
          </div>
          <div className="landing-compare" aria-label="Model comparison preview">
            {(data.leaderboard.length ? data.leaderboard.slice(0, 3) : []).map((entry) => (
              <div key={entry.modelId}>
                <span>{entry.name}</span>
                <strong className={entry.totalReturn >= 0 ? "text-green" : "text-red"}>
                  {fmtPct(entry.totalReturn)}
                </strong>
              </div>
            ))}
            {data.leaderboard.length === 0 && (
              <div>
                <span>Leaderboard</span>
                <strong>PENDING</strong>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-archive landing-archive--coming-soon">
          <div className="landing-section__heading landing-section__heading--center">
            <h2>HISTORICAL SEASONS ARCHIVE</h2>
            <p>
              Coming soon. Completed seasons will become a permanent record of winners, final
              ROI, drawdowns, turnover costs, and reproducible replay artifacts.
            </p>
          </div>
          <div className="landing-coming-soon">
            <strong>COMING SOON</strong>
            <span>Archive unlocks after the first completed season.</span>
          </div>
        </div>
      </section>

      <Ticker label="LIVE UPDATES" items={tickerItems} />

      <footer className="landing-footer">
        <div>
          <strong>LLM ARENA</strong>
          <span>©2024 LLM ARENA INSTITUTIONAL. ALL SYSTEM STATUSES OPERATIONAL.</span>
        </div>
        <nav aria-label="Footer navigation">
          <Link href="/">TERMINOLOGY</Link>
          <Link href="/">LEGAL</Link>
          <Link href="/">PRIVACY</Link>
          <Link href="/">STATUS</Link>
          <Link href="/">X_TWITTER</Link>
          <Link href="/">GITHUB</Link>
        </nav>
      </footer>
    </main>
  );
}
