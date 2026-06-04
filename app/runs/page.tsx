import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { runConfigKey } from "@/lib/run-redis-keys";
import { RunConfig } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#d7d7fd", "#d7f5d0", "#ffebeb", "#f3f3f3"];

function fmtCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default async function RunsPage() {
  const client = await getRedisClient();
  let config: RunConfig | null = null;

  try {
    const raw = await client.get(runConfigKey(ACTIVE_RUN_ID));
    if (raw) config = JSON.parse(raw);
  } finally {
    await client.disconnect();
  }

  return (
    <main className="landing-page">
      <Header active="simulator" />

      {/* Sub-header matching the new terminal design */}
      <div className="landing-terminal__header" style={{ justifyContent: "flex-start", gap: "16px", borderTop: "0", background: "var(--landing-surface)", color: "var(--landing-line)" }}>
        <span style={{ fontSize: "12px" }}>MODEL LINEUP</span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--landing-muted)" }}>Run: {ACTIVE_RUN_ID}</span>
        {config && (
          <>
            <span style={{ color: "var(--landing-muted)" }}>|</span>
            <span style={{ color: "var(--accent-green)" }}>
              <i style={{ background: "var(--accent-green)", display: "inline-block" }} /> {config.status?.toUpperCase() ?? "ACTIVE"}
            </span>
          </>
        )}
      </div>

      {!config ? (
        <section className="landing-section">
          <div className="landing-coming-soon" style={{ margin: "0 auto" }}>
            <strong>NO CONFIG YET</strong>
            <span>Initialize a run with the trading engine to see configuration.</span>
            <span style={{ marginTop: "16px" }}>Redis key: <code>run:{ACTIVE_RUN_ID}:config</code></span>
          </div>
        </section>
      ) : (
        <section className="landing-section" style={{ padding: 0 }}>
          <div className="arena-shell-grid">
            
            {/* Left — run details */}
            <div className="arena-main-panel">
              <h2 style={{ fontFamily: "IBM Plex Sans", fontSize: "24px", fontWeight: 800, marginBottom: "32px", textTransform: "uppercase" }}>
                {config.season ?? "Season 1"}
              </h2>

              {/* Key/value pairs */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "48px" }}>
                {[
                  ["Run ID", config.runId],
                  ["Start Date", config.startDate],
                  ...(config.endDate ? [["End Date", config.endDate]] : []),
                  ["Universe", `Nifty 50 (${config.universe?.length ?? 50} stocks)`],
                  ["Status", config.status?.toUpperCase() ?? "ACTIVE"],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--landing-surface-high)", paddingBottom: "8px", fontSize: "12px" }}>
                    <span style={{ color: "var(--landing-muted)", fontWeight: 700 }}>{label}</span>
                    <span style={{ fontWeight: 800 }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Trading rules grid */}
              <h3 style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "16px", borderTop: "1px solid var(--landing-line)", paddingTop: "32px" }}>
                TRADING RULES
              </h3>
              <div className="landing-stats arena-stat-grid arena-stat-grid--3" style={{ borderBottom: 0, background: "transparent" }}>
                {[
                  { label: "STARTING CAPITAL", value: fmtCurrency(config.rules.startingCapital) },
                  { label: "MAX POSITIONS", value: String(config.rules.maxPositions) },
                  { label: "MAX POSITION SIZE", value: `${(config.rules.maxPositionSizePct * 100).toFixed(0)}% of NAV` },
                  { label: "BROKERAGE", value: `${config.rules.brokerageBps} bps` },
                  { label: "SLIPPAGE", value: `${config.rules.slippageBps} bps` },
                  { label: "LEVERAGE", value: "None (v1)" },
                ].map(({ label, value }) => (
                  <div key={label} className="landing-mini-card" style={{ background: "var(--landing-surface)" }}>
                    <h3 style={{ fontSize: "18px", wordBreak: "break-word" }}>{value}</h3>
                    <p style={{ color: "var(--landing-muted)", fontSize: "10px", fontWeight: 700 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Scoring formula */}
              <div className="landing-mini-card" style={{ marginTop: "32px", padding: "24px", background: "var(--landing-surface-low)" }}>
                <h3 style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "8px" }}>SCORING FORMULA</h3>
                <code className="arena-code-line" style={{ fontSize: "14px", fontWeight: 700 }}>score = totalReturn − 0.5 × maxDrawdown − 0.1 × turnoverCost</code>
              </div>
            </div>

            {/* Right — model lineup */}
            <div className="arena-sidebar-panel">
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <h3 style={{ fontFamily: "IBM Plex Sans", fontSize: "18px", fontWeight: 800 }}>MODEL LINEUP</h3>
                <p style={{ fontSize: "12px", color: "var(--landing-muted)" }}>{config.models.length} competing models</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {config.models.map((model, idx) => {
                  const color = MODEL_COLORS[idx % MODEL_COLORS.length];
                  return (
                    <div key={model.modelId} className="landing-mini-card" style={{ background: "var(--landing-surface)", padding: "0" }}>
                      <div style={{ padding: "16px", borderLeft: `6px solid ${color}` }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontWeight: 800 }}>{model.name}</span>
                          <span style={{ fontSize: "10px", fontWeight: 700, background: color, border: "1px solid var(--landing-line)", padding: "2px 6px" }}>
                            {model.llm}
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: "var(--landing-muted)", marginBottom: "12px" }}>{model.strategy}</p>
                        <p style={{ fontSize: "10px", color: "var(--landing-muted)", marginBottom: "16px" }}>
                          ID: <code style={{ color: "var(--landing-line)" }}>{model.modelId}</code>
                        </p>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link href={`/portfolio/${model.modelId}`} className="landing-button" style={{ height: "24px", padding: "0 8px" }}>
                            Portfolio →
                          </Link>
                          <Link href={`/trades/${model.modelId}`} className="landing-button" style={{ height: "24px", padding: "0 8px" }}>
                            Trades →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </section>
      )}
    </main>
  );
}
