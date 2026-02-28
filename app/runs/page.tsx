import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { runConfigKey } from "@/lib/run-redis-keys";
import { RunConfig } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#e6e6fa", "#e6f7ff", "#fff0f6", "#f6ffed"];

function fmtINR(val: number) {
  return `₹${val.toLocaleString("en-IN")}`;
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
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header active="models" />

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
        <span style={{ fontWeight: 800 }}>MODEL LINEUP</span>
        <span style={{ color: "#999" }}>|</span>
        <span style={{ color: "#666" }}>Run: {ACTIVE_RUN_ID}</span>
        {config && (
          <>
            <span style={{ color: "#999" }}>|</span>
            <span style={{ color: "var(--accent-green)", fontWeight: "bold" }}>
              {config.status?.toUpperCase() ?? "ACTIVE"}
            </span>
          </>
        )}
      </div>

      {!config ? (
        <div style={{ padding: "2rem" }}>
          <div className="empty-state">
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>NO CONFIG YET</p>
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Initialize a run with the trading engine to see configuration.
            </p>
            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
              Redis key: <code>run:{ACTIVE_RUN_ID}:config</code>
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 340px",
            minHeight: "calc(100vh - 90px)",
          }}
        >
          {/* Left — run details */}
          <div style={{ padding: "2rem", borderRight: "2px solid #000" }}>
            <h2
              style={{
                fontWeight: 800,
                fontSize: "1.25rem",
                marginBottom: "1.5rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {config.season ?? "Season 1"}
            </h2>

            {/* Key/value pairs */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                marginBottom: "2rem",
              }}
            >
              {[
                ["Run ID", config.runId],
                ["Start Date", config.startDate],
                ...(config.endDate ? [["End Date", config.endDate]] : []),
                ["Universe", `Nifty 50 (${config.universe?.length ?? 50} stocks)`],
                ["Status", config.status?.toUpperCase() ?? "ACTIVE"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    borderBottom: "1px solid #ddd",
                    paddingBottom: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <span style={{ color: "#666", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.75rem" }}>
                    {label}
                  </span>
                  <span style={{ fontWeight: "bold" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Trading rules grid */}
            <h3
              style={{
                fontWeight: "bold",
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                borderTop: "2px solid #000",
                paddingTop: "1rem",
                marginBottom: "1rem",
              }}
            >
              Trading Rules
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.75rem",
              }}
            >
              {[
                { label: "Starting Capital", value: fmtINR(config.rules.startingCapital) },
                { label: "Max Positions", value: String(config.rules.maxPositions) },
                { label: "Max Position Size", value: `${(config.rules.maxPositionSizePct * 100).toFixed(0)}% of NAV` },
                { label: "Brokerage", value: `${config.rules.brokerageBps} bps` },
                { label: "Slippage", value: `${config.rules.slippageBps} bps` },
                { label: "Leverage", value: "None (v1)" },
              ].map(({ label, value }) => (
                <div className="stat-card" key={label}>
                  <div
                    style={{ fontWeight: 800, fontSize: "1rem", lineHeight: 1.1, wordBreak: "break-word" }}
                  >
                    {value}
                  </div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>

            {/* Scoring formula */}
            <div
              style={{
                border: "2px solid #000",
                padding: "1rem",
                marginTop: "2rem",
                backgroundColor: "#fafafa",
                fontSize: "0.8rem",
              }}
            >
              <p style={{ fontWeight: "bold", marginBottom: "0.4rem", fontSize: "0.75rem", letterSpacing: "0.05em" }}>
                SCORING FORMULA
              </p>
              <code style={{ fontSize: "0.85rem" }}>
                score = totalReturn − 0.5 × maxDrawdown − 0.1 × turnoverCost
              </code>
            </div>
          </div>

          {/* Right — model lineup */}
          <div style={{ padding: "1.5rem", backgroundColor: "#fafafa" }}>
            <h3
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                textAlign: "center",
                marginBottom: "0.5rem",
                textTransform: "uppercase",
              }}
            >
              Model Lineup
            </h3>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#666",
                textAlign: "center",
                borderBottom: "2px solid #000",
                paddingBottom: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              {config.models.length} competing models
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {config.models.map((model, idx) => {
                const color = MODEL_COLORS[idx % MODEL_COLORS.length];
                return (
                  <div
                    key={model.modelId}
                    style={{
                      border: "2px solid #000",
                      borderLeft: `5px solid ${color}`,
                      padding: "0.75rem 1rem",
                      backgroundColor: "#fff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "0.4rem",
                      }}
                    >
                      <span style={{ fontWeight: "bold" }}>{model.name}</span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          border: "1.5px solid #000",
                          padding: "0.1rem 0.4rem",
                          backgroundColor: color,
                        }}
                      >
                        {model.llm}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.5rem" }}>
                      {model.strategy}
                    </p>
                    <p style={{ fontSize: "0.7rem", color: "#999", marginBottom: "0.75rem" }}>
                      ID: <code>{model.modelId}</code>
                    </p>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <Link
                        href={`/portfolio/${model.modelId}`}
                        style={{
                          fontSize: "0.72rem",
                          border: "1.5px solid #000",
                          padding: "0.2rem 0.5rem",
                          color: "#000",
                          textDecoration: "none",
                        }}
                      >
                        Portfolio →
                      </Link>
                      <Link
                        href={`/trades/${model.modelId}`}
                        style={{
                          fontSize: "0.72rem",
                          border: "1.5px solid #000",
                          padding: "0.2rem 0.5rem",
                          color: "#000",
                          textDecoration: "none",
                        }}
                      >
                        Trades →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
