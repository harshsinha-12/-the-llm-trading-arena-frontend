import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { runLeaderboardKey, runConfigKey } from "@/lib/run-redis-keys";
import { LeaderboardEntry, RunConfig, ModelConfig } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#d7d7fd", "#d7f5d0", "#ffebeb", "#f3f3f3"];

function getModelColor(modelId: string, models: ModelConfig[]): string {
  const idx = models.findIndex((m) => m.modelId === modelId);
  return idx !== -1 ? MODEL_COLORS[idx % MODEL_COLORS.length] : "#e8e8e8";
}

function fmtPct(val: number) {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(2)}%`;
}

function fmtCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default async function LeaderboardPage() {
  const client = await getRedisClient();
  let entries: LeaderboardEntry[] = [];
  let config: RunConfig | null = null;

  try {
    const [lbRaw, cfgRaw] = await Promise.all([
      client.get(runLeaderboardKey(ACTIVE_RUN_ID)),
      client.get(runConfigKey(ACTIVE_RUN_ID)),
    ]);
    if (lbRaw) entries = JSON.parse(lbRaw);
    if (cfgRaw) config = JSON.parse(cfgRaw);
  } finally {
    await client.disconnect();
  }

  const models = config?.models ?? [];

  return (
    <main className="landing-page">
      <Header active="rankings" />

      {/* Sub-header matching the new terminal design */}
      <div className="landing-terminal__header" style={{ justifyContent: "flex-start", gap: "16px", borderTop: "0", background: "var(--landing-surface)", color: "var(--landing-line)" }}>
        <span style={{ fontSize: "12px" }}>
          LEADERBOARD
        </span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--landing-muted)" }}>{config?.season ?? "Season 1"}</span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--accent-green)" }}>
          <i style={{ background: "var(--accent-green)", display: "inline-block" }} /> {config?.status?.toUpperCase() ?? "ACTIVE"}
        </span>
        {config?.startDate && (
          <>
            <span style={{ color: "var(--landing-muted)" }}>|</span>
            <span style={{ color: "var(--landing-muted)" }}>Started: {config.startDate}</span>
          </>
        )}
      </div>

      <section className="landing-section">
        <div className="landing-section__inner">
          {entries.length === 0 ? (
            <div className="landing-coming-soon" style={{ margin: "0 auto" }}>
              <strong>NO DATA YET</strong>
              <span>Run the trading engine to populate the leaderboard.</span>
              <span style={{ marginTop: "16px" }}>Redis key: <code>run:{ACTIVE_RUN_ID}:leaderboard:latest</code></span>
            </div>
          ) : (
            <div className="landing-dashboard" style={{ overflowX: "auto", padding: "0" }}>
              <div className="landing-leaderboard__head" style={{ gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1.5fr", padding: "0 16px" }}>
                <span>#</span>
                <span style={{ textAlign: "left" }}>MODEL</span>
                <span style={{ textAlign: "right" }}>SCORE</span>
                <span style={{ textAlign: "right" }}>TOTAL RETURN</span>
                <span style={{ textAlign: "right" }}>MAX DRAWDOWN</span>
                <span style={{ textAlign: "right" }}>TURNOVER COST</span>
                <span style={{ textAlign: "right" }}>NAV</span>
                <span style={{ textAlign: "right" }}>TRADES</span>
                <span style={{ textAlign: "right" }}>ACTIONS</span>
              </div>
              
              <div className="landing-leaderboard" style={{ minHeight: "auto", border: "0", borderTop: "1px solid var(--landing-line)" }}>
                {entries.map((entry) => {
                  const color = getModelColor(entry.modelId, models);
                  return (
                    <div key={entry.modelId} className="landing-leaderboard__row" style={{ gridTemplateColumns: "40px 2fr 1fr 1fr 1fr 1fr 1fr 1fr 1.5fr", padding: "0 16px" }}>
                      <span style={{ fontWeight: 800 }}>{entry.rank}</span>
                      <strong style={{ justifyContent: "flex-start" }}>
                        <i style={{ background: color, border: "1px solid var(--landing-line)" }} /> {entry.name}
                      </strong>
                      <span style={{ textAlign: "right", fontWeight: 700, color: entry.score >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {entry.score >= 0 ? "+" : ""}{entry.score.toFixed(4)}
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 700, color: entry.totalReturn >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {fmtPct(entry.totalReturn)}
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 700, color: "var(--accent-red)" }}>
                        {fmtPct(entry.maxDrawdown)}
                      </span>
                      <span style={{ textAlign: "right", color: "var(--landing-muted)" }}>
                        {fmtPct(entry.turnoverCost)}
                      </span>
                      <span style={{ textAlign: "right", fontWeight: 700 }}>
                        {fmtCurrency(entry.nav)}
                      </span>
                      <span style={{ textAlign: "right", color: "var(--landing-muted)" }}>
                        {entry.numTrades ?? "—"}
                      </span>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <Link href={`/portfolio/${entry.modelId}`} className="landing-button" style={{ minHeight: "24px", height: "24px", padding: "0 8px" }}>
                          PORTFOLIO
                        </Link>
                        <Link href={`/trades/${entry.modelId}`} className="landing-button" style={{ minHeight: "24px", height: "24px", padding: "0 8px" }}>
                          TRADES
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scoring formula */}
          <div className="landing-mini-card" style={{ marginTop: "32px", padding: "24px", background: "var(--landing-surface-low)" }}>
            <h3 style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "8px" }}>SCORING FORMULA</h3>
            <code style={{ fontSize: "14px", fontWeight: 700 }}>score = totalReturn − 0.5 × maxDrawdown − 0.1 × turnoverCost</code>
          </div>

          {/* Link to all models */}
          {models.length > 0 && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "32px" }}>
              {models.map((m, idx) => (
                <Link
                  key={m.modelId}
                  href={`/portfolio/${m.modelId}`}
                  className="landing-button"
                  style={{ background: MODEL_COLORS[idx % MODEL_COLORS.length] }}
                >
                  <i style={{ background: "var(--landing-surface)", width: "8px", height: "8px", border: "1px solid var(--landing-line)", marginRight: "8px" }} />
                  {m.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
