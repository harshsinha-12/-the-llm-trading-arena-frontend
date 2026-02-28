import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { runLeaderboardKey, runConfigKey } from "@/lib/run-redis-keys";
import { LeaderboardEntry, RunConfig, ModelConfig } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#e6e6fa", "#e6f7ff", "#fff0f6", "#f6ffed"];

function getModelColor(modelId: string, models: ModelConfig[]): string {
  const idx = models.findIndex((m) => m.modelId === modelId);
  return idx !== -1 ? MODEL_COLORS[idx % MODEL_COLORS.length] : "#f0f0f0";
}

function fmtPct(val: number) {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(2)}%`;
}

function fmtINR(val: number) {
  return `₹${(val / 100000).toFixed(2)}L`;
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
        <span style={{ fontWeight: 800 }}>LEADERBOARD</span>
        <span style={{ color: "#999" }}>|</span>
        <span style={{ color: "#666" }}>{config?.season ?? "Season 1"}</span>
        <span style={{ color: "#999" }}>|</span>
        <span style={{ color: "var(--accent-green)", fontWeight: "bold" }}>
          {config?.status?.toUpperCase() ?? "ACTIVE"}
        </span>
        {config?.startDate && (
          <>
            <span style={{ color: "#999" }}>|</span>
            <span style={{ color: "#666", fontSize: "0.75rem" }}>
              Started: {config.startDate}
            </span>
          </>
        )}
      </div>

      <div style={{ padding: "2rem" }}>
        {entries.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>NO DATA YET</p>
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Run the trading engine to populate the leaderboard.
            </p>
            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
              Redis key:{" "}
              <code>run:{ACTIVE_RUN_ID}:leaderboard:latest</code>
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>MODEL</th>
                  <th style={{ textAlign: "right" }}>SCORE</th>
                  <th style={{ textAlign: "right" }}>TOTAL RETURN</th>
                  <th style={{ textAlign: "right" }}>MAX DRAWDOWN</th>
                  <th style={{ textAlign: "right" }}>TURNOVER COST</th>
                  <th style={{ textAlign: "right" }}>NAV</th>
                  <th style={{ textAlign: "right" }}>TRADES</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const color = getModelColor(entry.modelId, models);
                  return (
                    <tr key={entry.modelId}>
                      <td style={{ fontWeight: "bold" }}>{entry.rank}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              width: "12px",
                              height: "12px",
                              backgroundColor: color,
                              display: "inline-block",
                              border: "1.5px solid #000",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: "bold" }}>{entry.name}</span>
                        </div>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: "bold",
                          color: entry.score >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                        }}
                      >
                        {entry.score >= 0 ? "+" : ""}
                        {entry.score.toFixed(4)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          color: entry.totalReturn >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                        }}
                      >
                        {fmtPct(entry.totalReturn)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--accent-red)" }}>
                        {fmtPct(entry.maxDrawdown)}
                      </td>
                      <td style={{ textAlign: "right", color: "#666" }}>
                        {fmtPct(entry.turnoverCost)}
                      </td>
                      <td style={{ textAlign: "right" }}>{fmtINR(entry.nav)}</td>
                      <td style={{ textAlign: "right", color: "#666" }}>
                        {entry.numTrades ?? "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <Link
                            href={`/portfolio/${entry.modelId}`}
                            style={{
                              fontSize: "0.75rem",
                              border: "1.5px solid #000",
                              padding: "0.2rem 0.5rem",
                              color: "#000",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Portfolio
                          </Link>
                          <Link
                            href={`/trades/${entry.modelId}`}
                            style={{
                              fontSize: "0.75rem",
                              border: "1.5px solid #000",
                              padding: "0.2rem 0.5rem",
                              color: "#000",
                              textDecoration: "none",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Trades
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

        {/* Link to all models */}
        {models.length > 0 && (
          <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {models.map((m, idx) => (
              <Link
                key={m.modelId}
                href={`/portfolio/${m.modelId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  border: "2px solid #000",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.75rem",
                  color: "#000",
                  textDecoration: "none",
                  backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length],
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    border: "1px solid #000",
                    backgroundColor: MODEL_COLORS[idx % MODEL_COLORS.length],
                    display: "inline-block",
                  }}
                />
                {m.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
