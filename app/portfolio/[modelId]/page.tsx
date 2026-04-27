import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { modelStateKey, modelTradesKey, runConfigKey } from "@/lib/run-redis-keys";
import { ohlcKey } from "@/lib/redis-keys";
import { ModelState, RunConfig, Trade, PortfolioAnalytics, OHLC, Position } from "@/types/global";
import { computePortfolioAnalytics, savePortfolioAnalytics } from "@/lib/portfolio-analytics";
import Link from "next/link";

const MODEL_COLORS = ["#e6e6fa", "#e6f7ff", "#fff0f6", "#f6ffed"];

// ─── helpers ────────────────────────────────────────────────────────────────

async function enrichWithCurrentPrices(
  client: Awaited<ReturnType<typeof getRedisClient>>,
  state: ModelState
): Promise<ModelState> {
  const enrichedPositions: Position[] = await Promise.all(
    state.positions.map(async (pos) => {
      try {
        const raw = await client.get(ohlcKey(pos.mbCode, "1Y"));
        if (!raw) return pos;
        const data: OHLC[] = JSON.parse(raw);
        if (!Array.isArray(data) || data.length === 0) return pos;
        const currentPrice = data[data.length - 1].close;
        const pnl = (currentPrice - pos.avgPrice) * pos.quantity;
        const pnlPct = (currentPrice - pos.avgPrice) / pos.avgPrice;
        return { ...pos, currentPrice, pnl, pnlPct };
      } catch {
        return pos;
      }
    })
  );

  const nav =
    state.cash +
    enrichedPositions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);

  return { ...state, positions: enrichedPositions, nav };
}

function fmtINR(val: number, decimals = 0) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: decimals })}`;
}

function fmtPct(val: number, showSign = true) {
  const sign = showSign && val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(2)}%`;
}

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const client = await getRedisClient();
  let state: ModelState | null = null;
  let config: RunConfig | null = null;
  let analytics: PortfolioAnalytics | null = null;

  try {
    const [stateRaw, cfgRaw, tradesRaw] = await Promise.all([
      client.get(modelStateKey(ACTIVE_RUN_ID, modelId)),
      client.get(runConfigKey(ACTIVE_RUN_ID)),
      client.get(modelTradesKey(ACTIVE_RUN_ID, modelId)),
    ]);
    if (stateRaw) state = JSON.parse(stateRaw);
    if (cfgRaw) config = JSON.parse(cfgRaw);

    if (state) {
      // Enrich positions with latest OHLC close prices (same source as the ticker bar)
      state = await enrichWithCurrentPrices(client, state);
      const trades: Trade[] = tradesRaw ? JSON.parse(tradesRaw) : [];
      analytics = computePortfolioAnalytics(ACTIVE_RUN_ID, state, trades);
      // Persist analytics so the LLM agent can use them as context on each tick
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await savePortfolioAnalytics(client as any, analytics);
    }
  } finally {
    await client.disconnect();
  }

  const modelConfig = config?.models.find((m) => m.modelId === modelId);
  const modelName = modelConfig?.name ?? modelId;
  const modelIdx = config?.models.findIndex((m) => m.modelId === modelId) ?? 0;
  const modelColor = MODEL_COLORS[modelIdx >= 0 ? modelIdx % MODEL_COLORS.length : 0];

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header active="leaderboard" />

      {/* Sub-header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "2px solid #000",
          padding: "0.5rem 1rem",
          fontSize: "0.85rem",
          gap: "0.75rem",
        }}
      >
        <Link href={`/models/${modelId}`} style={{ color: "#666", textDecoration: "none", fontSize: "0.8rem" }}>
          ← MODEL
        </Link>
        <span style={{ color: "#999" }}>|</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            style={{
              width: "12px",
              height: "12px",
              backgroundColor: modelColor,
              display: "inline-block",
              border: "1.5px solid #000",
            }}
          />
          <span style={{ fontWeight: 800 }}>{modelName.toUpperCase()}</span>
        </span>
        <span style={{ color: "#999" }}>|</span>
        <span style={{ color: "#666" }}>PORTFOLIO</span>
        {state && (
          <>
            <span style={{ color: "#999" }}>|</span>
            <span style={{ fontWeight: "bold" }}>NAV: {fmtINR(state.nav)}</span>
          </>
        )}
      </div>

      {!state ? (
        <div style={{ padding: "2rem" }}>
          <div className="empty-state">
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>NO DATA YET</p>
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              The engine has not written state for this model yet.
            </p>
            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
              Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:state</code>
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            minHeight: "calc(100vh - 90px)",
          }}
        >
          {/* Left sidebar */}
          <div style={{ padding: "1.25rem", borderRight: "2px solid #000" }}>
            {/* NAV card */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1rem",
                marginBottom: "1rem",
                backgroundColor: modelColor,
              }}
            >
              <div style={{ fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem" }}>
                Net Asset Value
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.1 }}>
                {fmtINR(state.nav)}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  marginTop: "0.3rem",
                  color: state.nav >= 1_000_000 ? "var(--accent-green)" : "var(--accent-red)",
                }}
              >
                {state.nav >= 1_000_000 ? "▲" : "▼"}{" "}
                {Math.abs(((state.nav - 1_000_000) / 1_000_000) * 100).toFixed(2)}% from start
              </div>
            </div>

            {/* Quick stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                marginBottom: "1rem",
              }}
            >
              <div className="stat-card">
                <div className="stat-value">{((state.cash / state.nav) * 100).toFixed(0)}%</div>
                <div className="stat-label">CASH FREE</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{state.positions.length}</div>
                <div className="stat-label">POSITIONS</div>
              </div>
            </div>

            {/* Detailed metrics */}
            <div style={{ borderTop: "2px solid #000", paddingTop: "1rem" }}>
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.75rem",
                }}
              >
                Performance
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[
                  {
                    label: "Total Return",
                    value: fmtPct((state.nav - 1_000_000) / 1_000_000),
                    color: state.nav >= 1_000_000 ? "var(--accent-green)" : "var(--accent-red)",
                    bold: true,
                  },
                  {
                    label: "Max Drawdown",
                    value: fmtPct(state.metrics.maxDrawdown),
                    color: "var(--accent-red)",
                    bold: false,
                  },
                  {
                    label: "Score",
                    value: state.metrics.score.toFixed(4),
                    color: "#000",
                    bold: true,
                  },
                  ...(state.metrics.hhi !== undefined
                    ? [{ label: "HHI (Conc.)", value: state.metrics.hhi.toFixed(3), color: "#000", bold: false }]
                    : []),
                  {
                    label: "Turnover Cost",
                    value: fmtPct(state.metrics.turnoverCost),
                    color: "#666",
                    bold: false,
                  },
                  ...(state.metrics.numTrades !== undefined
                    ? [{ label: "Trades", value: String(state.metrics.numTrades), color: "#000", bold: false }]
                    : []),
                ].map(({ label, value, color, bold }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.8rem",
                    }}
                  >
                    <span style={{ color: "#666" }}>{label}</span>
                    <span style={{ color, fontWeight: bold ? "bold" : "normal" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio analytics */}
            {analytics && (
              <div style={{ borderTop: "2px solid #000", paddingTop: "1rem", marginTop: "1rem" }}>
                <p
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.75rem",
                  }}
                >
                  Portfolio Analytics
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[
                    { label: "Exposure",         value: fmtPct(analytics.exposurePct, false), color: "#000", bold: false },
                    { label: "Unrealized P&L",   value: fmtINR(analytics.unrealizedPnL), color: analytics.unrealizedPnL >= 0 ? "var(--accent-green)" : "var(--accent-red)", bold: false },
                    { label: "Realized P&L",     value: fmtINR(analytics.realizedPnL), color: analytics.realizedPnL >= 0 ? "var(--accent-green)" : "var(--accent-red)", bold: false },
                    { label: "Win Rate",         value: fmtPct(analytics.winRate, false), color: "#000", bold: false },
                    { label: "Profit Factor",    value: isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : "∞", color: analytics.profitFactor >= 1 ? "var(--accent-green)" : "var(--accent-red)", bold: true },
                    { label: "Avg Win",          value: fmtINR(analytics.avgWin), color: "var(--accent-green)", bold: false },
                    { label: "Avg Loss",         value: fmtINR(analytics.avgLoss), color: "var(--accent-red)", bold: false },
                    { label: "Avg MAE",          value: fmtPct(analytics.avgMAE), color: "var(--accent-red)", bold: false },
                    { label: "Avg MFE",          value: fmtPct(analytics.avgMFE), color: "var(--accent-green)", bold: false },
                    { label: "Vol. Proxy",       value: fmtPct(analytics.portfolioVolatilityProxy, false), color: "#666", bold: false },
                  ].map(({ label, value, color, bold }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                      <span style={{ color: "#666" }}>{label}</span>
                      <span style={{ color, fontWeight: bold ? "bold" : "normal" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.lastUpdated && (
              <p style={{ fontSize: "0.7rem", color: "#999", marginTop: "1.5rem" }}>
                Updated:{" "}
                {new Date(state.lastUpdated).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}

            <Link
              href={`/trades/${modelId}`}
              style={{
                display: "block",
                marginTop: "1rem",
                border: "2px solid #000",
                padding: "0.5rem",
                textAlign: "center",
                color: "#000",
                textDecoration: "none",
                fontSize: "0.8rem",
                fontWeight: "bold",
              }}
            >
              VIEW TRADE HISTORY →
            </Link>
          </div>

          {/* Right — positions */}
          <div style={{ padding: "1.5rem 2rem" }}>
            <h2
              style={{
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "1.25rem",
              }}
            >
              Open Positions
            </h2>

            {state.positions.length === 0 ? (
              <div className="empty-state" style={{ padding: "2rem" }}>
                <p style={{ fontSize: "0.85rem", color: "#666" }}>No open positions</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>SYMBOL</th>
                      <th style={{ textAlign: "right" }}>QTY</th>
                      <th style={{ textAlign: "right" }}>AVG PRICE</th>
                      <th style={{ textAlign: "right" }}>CUR PRICE</th>
                      <th style={{ textAlign: "right" }}>VALUE</th>
                      <th style={{ textAlign: "right" }}>P&L</th>
                      <th style={{ textAlign: "right" }}>P&L %</th>
                      {state.positions.some((p) => p.mae !== undefined) && (
                        <th style={{ textAlign: "right" }}>MAE</th>
                      )}
                      {state.positions.some((p) => p.mfe !== undefined) && (
                        <th style={{ textAlign: "right" }}>MFE</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {state.positions.map((pos) => (
                      <tr key={pos.symbol}>
                        <td style={{ fontWeight: "bold" }}>{pos.symbol}</td>
                        <td style={{ textAlign: "right" }}>{pos.quantity}</td>
                        <td style={{ textAlign: "right" }}>
                          {fmtINR(pos.avgPrice, 2)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {fmtINR(pos.currentPrice, 2)}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {fmtINR(pos.quantity * pos.currentPrice)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: "bold",
                            color: pos.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                          }}
                        >
                          {pos.pnl >= 0 ? "+" : ""}
                          {fmtINR(pos.pnl)}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: pos.pnlPct >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                          }}
                        >
                          {fmtPct(pos.pnlPct)}
                        </td>
                        {pos.mae !== undefined && (
                          <td style={{ textAlign: "right", color: "var(--accent-red)", fontSize: "0.8rem" }}>
                            {fmtPct(pos.mae)}
                          </td>
                        )}
                        {pos.mfe !== undefined && (
                          <td style={{ textAlign: "right", color: "var(--accent-green)", fontSize: "0.8rem" }}>
                            {fmtPct(pos.mfe)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Cash row */}
            <div
              style={{
                marginTop: "1.5rem",
                borderTop: "2px solid #000",
                paddingTop: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.9rem",
              }}
            >
              <span style={{ color: "#666" }}>Cash available</span>
              <span style={{ fontWeight: "bold" }}>{fmtINR(state.cash)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
