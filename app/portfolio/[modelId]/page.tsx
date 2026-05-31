import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { modelStateKey, modelTradesKey, runConfigKey } from "@/lib/run-redis-keys";
import { ohlcKey } from "@/lib/redis-keys";
import { ModelState, RunConfig, Trade, PortfolioAnalytics, OHLC, Position } from "@/types/global";
import { computePortfolioAnalytics, savePortfolioAnalytics } from "@/lib/portfolio-analytics";
import Link from "next/link";

const MODEL_COLORS = ["#d7d7fd", "#d7f5d0", "#ffebeb", "#f3f3f3"];

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
      state = await enrichWithCurrentPrices(client, state);
      const trades: Trade[] = tradesRaw ? JSON.parse(tradesRaw) : [];
      analytics = computePortfolioAnalytics(ACTIVE_RUN_ID, state, trades);
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
    <main className="landing-page">
      <Header active="portfolio" />

      {/* Sub-header */}
      <div className="landing-terminal__header" style={{ justifyContent: "flex-start", gap: "16px", borderTop: "0", background: "var(--landing-surface)", color: "var(--landing-line)" }}>
        <Link href={`/runs`} style={{ color: "var(--landing-muted)", textDecoration: "none" }}>
          ← BACK
        </Link>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <i style={{ width: "12px", height: "12px", background: modelColor, border: "1px solid var(--landing-line)", display: "inline-block" }} />
          <span style={{ fontWeight: 800 }}>{modelName.toUpperCase()}</span>
        </span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--landing-muted)" }}>PORTFOLIO</span>
        {state && (
          <>
            <span style={{ color: "var(--landing-muted)" }}>|</span>
            <span style={{ fontWeight: 800 }}>NAV: {fmtINR(state.nav)}</span>
          </>
        )}
      </div>

      {!state ? (
        <section className="landing-section">
          <div className="landing-coming-soon" style={{ margin: "0 auto" }}>
            <strong>NO DATA YET</strong>
            <span>The engine has not written state for this model yet.</span>
            <span style={{ marginTop: "16px" }}>Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:state</code></span>
          </div>
        </section>
      ) : (
        <section className="landing-section" style={{ padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: "calc(100vh - 105px)" }}>
            
            {/* Left sidebar */}
            <div style={{ padding: "32px", borderRight: "1px solid var(--landing-line)", background: "var(--landing-surface-low)" }}>
              {/* NAV card */}
              <div className="landing-mini-card" style={{ background: modelColor, border: "1px solid var(--landing-line)", marginBottom: "24px" }}>
                <p style={{ fontSize: "10px", color: "var(--landing-muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Net Asset Value
                </p>
                <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "8px" }}>
                  {fmtINR(state.nav)}
                </div>
                <div style={{ fontSize: "12px", marginTop: "8px", fontWeight: 700, color: state.nav >= 1_000_000 ? "var(--accent-green)" : "var(--accent-red)" }}>
                  {state.nav >= 1_000_000 ? "▲" : "▼"} {Math.abs(((state.nav - 1_000_000) / 1_000_000) * 100).toFixed(2)}% from start
                </div>
              </div>

              {/* Quick stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
                <div className="landing-mini-card" style={{ background: "var(--landing-surface)", padding: "16px" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800 }}>{((state.cash / state.nav) * 100).toFixed(0)}%</div>
                  <div style={{ fontSize: "10px", color: "var(--landing-muted)", fontWeight: 700 }}>CASH FREE</div>
                </div>
                <div className="landing-mini-card" style={{ background: "var(--landing-surface)", padding: "16px" }}>
                  <div style={{ fontSize: "24px", fontWeight: 800 }}>{state.positions.length}</div>
                  <div style={{ fontSize: "10px", color: "var(--landing-muted)", fontWeight: 700 }}>POSITIONS</div>
                </div>
              </div>

              {/* Detailed metrics */}
              <div style={{ borderTop: "1px solid var(--landing-line)", paddingTop: "24px" }}>
                <h3 style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "16px", textTransform: "uppercase", fontWeight: 700 }}>
                  Performance
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[
                    { label: "Total Return", value: fmtPct((state.nav - 1_000_000) / 1_000_000), color: state.nav >= 1_000_000 ? "var(--accent-green)" : "var(--accent-red)", bold: true },
                    { label: "Max Drawdown", value: fmtPct(state.metrics.maxDrawdown), color: "var(--accent-red)", bold: false },
                    { label: "Score", value: state.metrics.score.toFixed(4), color: "var(--landing-line)", bold: true },
                    ...(state.metrics.hhi !== undefined ? [{ label: "HHI (Conc.)", value: state.metrics.hhi.toFixed(3), color: "var(--landing-line)", bold: false }] : []),
                    { label: "Turnover Cost", value: fmtPct(state.metrics.turnoverCost), color: "var(--landing-muted)", bold: false },
                    ...(state.metrics.numTrades !== undefined ? [{ label: "Trades", value: String(state.metrics.numTrades), color: "var(--landing-line)", bold: false }] : []),
                  ].map(({ label, value, color, bold }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ color: "var(--landing-muted)" }}>{label}</span>
                      <span style={{ color, fontWeight: bold ? 800 : 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Portfolio analytics */}
              {analytics && (
                <div style={{ borderTop: "1px solid var(--landing-line)", paddingTop: "24px", marginTop: "24px" }}>
                  <h3 style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "16px", textTransform: "uppercase", fontWeight: 700 }}>
                    Portfolio Analytics
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { label: "Exposure", value: fmtPct(analytics.exposurePct, false), color: "var(--landing-line)", bold: false },
                      { label: "Unrealized P&L", value: fmtINR(analytics.unrealizedPnL), color: analytics.unrealizedPnL >= 0 ? "var(--accent-green)" : "var(--accent-red)", bold: false },
                      { label: "Realized P&L", value: fmtINR(analytics.realizedPnL), color: analytics.realizedPnL >= 0 ? "var(--accent-green)" : "var(--accent-red)", bold: false },
                      { label: "Win Rate", value: fmtPct(analytics.winRate, false), color: "var(--landing-line)", bold: false },
                      { label: "Profit Factor", value: isFinite(analytics.profitFactor) ? analytics.profitFactor.toFixed(2) : "∞", color: analytics.profitFactor >= 1 ? "var(--accent-green)" : "var(--accent-red)", bold: true },
                      { label: "Avg Win", value: fmtINR(analytics.avgWin), color: "var(--accent-green)", bold: false },
                      { label: "Avg Loss", value: fmtINR(analytics.avgLoss), color: "var(--accent-red)", bold: false },
                      { label: "Avg MAE", value: fmtPct(analytics.avgMAE), color: "var(--accent-red)", bold: false },
                      { label: "Avg MFE", value: fmtPct(analytics.avgMFE), color: "var(--accent-green)", bold: false },
                      { label: "Vol. Proxy", value: fmtPct(analytics.portfolioVolatilityProxy, false), color: "var(--landing-muted)", bold: false },
                    ].map(({ label, value, color, bold }) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                        <span style={{ color: "var(--landing-muted)" }}>{label}</span>
                        <span style={{ color, fontWeight: bold ? 800 : 500 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {state.lastUpdated && (
                <p style={{ fontSize: "10px", color: "var(--landing-muted)", marginTop: "32px" }}>
                  Updated: {new Date(state.lastUpdated).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "24px" }}>
                <Link href={`/trades/${modelId}`} className="landing-button" style={{ justifyContent: "center" }}>
                  VIEW TRADE HISTORY →
                </Link>
                <Link href={`/models/${modelId}`} className="landing-button" style={{ justifyContent: "center" }}>
                  VIEW MODEL THOUGHTS →
                </Link>
              </div>
            </div>

            {/* Right — positions */}
            <div style={{ padding: "48px" }}>
              <h2 style={{ fontFamily: "IBM Plex Sans", fontSize: "20px", fontWeight: 800, textTransform: "uppercase", marginBottom: "32px" }}>
                Open Positions
              </h2>

              {state.positions.length === 0 ? (
                <div className="landing-coming-soon" style={{ margin: "0", minHeight: "200px" }}>
                  <span style={{ color: "var(--landing-muted)" }}>No open positions</span>
                </div>
              ) : (
                <div className="landing-dashboard" style={{ overflowX: "auto", padding: 0 }}>
                  <div className="landing-leaderboard__head" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr 1fr" + (state.positions.some(p => p.mae !== undefined) ? " 1fr" : "") + (state.positions.some(p => p.mfe !== undefined) ? " 1fr" : ""), padding: "0 16px" }}>
                    <span style={{ textAlign: "left" }}>SYMBOL</span>
                    <span style={{ textAlign: "right" }}>QTY</span>
                    <span style={{ textAlign: "right" }}>AVG PRICE</span>
                    <span style={{ textAlign: "right" }}>CUR PRICE</span>
                    <span style={{ textAlign: "right" }}>VALUE</span>
                    <span style={{ textAlign: "right" }}>P&L</span>
                    <span style={{ textAlign: "right" }}>P&L %</span>
                    {state.positions.some((p) => p.mae !== undefined) && <span style={{ textAlign: "right" }}>MAE</span>}
                    {state.positions.some((p) => p.mfe !== undefined) && <span style={{ textAlign: "right" }}>MFE</span>}
                  </div>
                  <div className="landing-leaderboard" style={{ minHeight: "auto", border: 0, borderTop: "1px solid var(--landing-line)" }}>
                    {state.positions.map((pos) => (
                      <div key={pos.symbol} className="landing-leaderboard__row" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr 1fr 1fr" + (state.positions.some(p => p.mae !== undefined) ? " 1fr" : "") + (state.positions.some(p => p.mfe !== undefined) ? " 1fr" : ""), padding: "0 16px" }}>
                        <strong style={{ justifyContent: "flex-start" }}>{pos.symbol}</strong>
                        <span style={{ textAlign: "right" }}>{pos.quantity}</span>
                        <span style={{ textAlign: "right" }}>{fmtINR(pos.avgPrice, 2)}</span>
                        <span style={{ textAlign: "right", fontWeight: 700 }}>{fmtINR(pos.currentPrice, 2)}</span>
                        <span style={{ textAlign: "right", fontWeight: 700 }}>{fmtINR(pos.quantity * pos.currentPrice)}</span>
                        <span style={{ textAlign: "right", fontWeight: 700, color: pos.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {pos.pnl >= 0 ? "+" : ""}{fmtINR(pos.pnl)}
                        </span>
                        <span style={{ textAlign: "right", color: pos.pnlPct >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {fmtPct(pos.pnlPct)}
                        </span>
                        {pos.mae !== undefined && (
                          <span style={{ textAlign: "right", color: "var(--accent-red)", fontSize: "12px" }}>{fmtPct(pos.mae)}</span>
                        )}
                        {pos.mfe !== undefined && (
                          <span style={{ textAlign: "right", color: "var(--accent-green)", fontSize: "12px" }}>{fmtPct(pos.mfe)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cash row */}
              <div style={{ marginTop: "32px", borderTop: "1px solid var(--landing-line)", paddingTop: "16px", display: "flex", justifyContent: "space-between", fontSize: "16px" }}>
                <span style={{ color: "var(--landing-muted)" }}>Cash available</span>
                <span style={{ fontWeight: 800 }}>{fmtINR(state.cash)}</span>
              </div>
            </div>

          </div>
        </section>
      )}
    </main>
  );
}
