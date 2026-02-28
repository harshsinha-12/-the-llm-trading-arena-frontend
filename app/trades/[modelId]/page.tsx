import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { modelTradesKey, runConfigKey } from "@/lib/run-redis-keys";
import { Trade, RunConfig } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#e6e6fa", "#e6f7ff", "#fff0f6", "#f6ffed"];

function fmtINR(val: number, decimals = 0) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: decimals })}`;
}

export default async function TradesPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const client = await getRedisClient();
  let trades: Trade[] = [];
  let config: RunConfig | null = null;

  try {
    const [tradesRaw, cfgRaw] = await Promise.all([
      client.get(modelTradesKey(ACTIVE_RUN_ID, modelId)),
      client.get(runConfigKey(ACTIVE_RUN_ID)),
    ]);
    if (tradesRaw) trades = JSON.parse(tradesRaw);
    if (cfgRaw) config = JSON.parse(cfgRaw);
  } finally {
    await client.disconnect();
  }

  const modelConfig = config?.models.find((m) => m.modelId === modelId);
  const modelName = modelConfig?.name ?? modelId;
  const modelIdx = config?.models.findIndex((m) => m.modelId === modelId) ?? 0;
  const modelColor = MODEL_COLORS[modelIdx >= 0 ? modelIdx % MODEL_COLORS.length : 0];

  // Sort newest first
  const sorted = [...trades].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const buys = trades.filter((t) => t.side === "BUY").length;
  const sells = trades.filter((t) => t.side === "SELL").length;
  const closed = trades.filter((t) => t.pnl !== undefined);
  const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winners = closed.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? ((winners / closed.length) * 100).toFixed(0) + "%" : "—";

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
          flexWrap: "wrap",
        }}
      >
        <Link href="/leaderboard" style={{ color: "#666", textDecoration: "none", fontSize: "0.8rem" }}>
          ← LEADERBOARD
        </Link>
        <span style={{ color: "#999" }}>|</span>
        <Link
          href={`/portfolio/${modelId}`}
          style={{ color: "#666", textDecoration: "none", fontSize: "0.8rem" }}
        >
          ← PORTFOLIO
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
        <span style={{ color: "#666" }}>TRADE HISTORY</span>
      </div>

      <div style={{ padding: "1.5rem 2rem" }}>
        {/* Summary stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "TOTAL TRADES", value: String(trades.length) },
            { label: "BUY / SELL", value: `${buys} / ${sells}` },
            {
              label: "REALIZED P&L",
              value: fmtINR(totalPnl),
              color: totalPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
            },
            { label: "WIN RATE", value: winRate },
          ].map(({ label, value, color }) => (
            <div className="stat-card" key={label}>
              <div className="stat-value" style={{ color: color ?? "#000" }}>
                {value}
              </div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>NO TRADES YET</p>
            <p style={{ fontSize: "0.8rem", color: "#666" }}>
              Run the trading engine to generate trades.
            </p>
            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
              Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:trades</code>
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SYMBOL</th>
                  <th>SIDE</th>
                  <th style={{ textAlign: "right" }}>QTY</th>
                  <th style={{ textAlign: "right" }}>PRICE</th>
                  <th style={{ textAlign: "right" }}>VALUE</th>
                  <th style={{ textAlign: "right" }}>P&L</th>
                  <th>REASON</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((trade) => (
                  <tr key={trade.tradeId}>
                    <td style={{ whiteSpace: "nowrap", color: "#666", fontSize: "0.8rem" }}>
                      {new Date(trade.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      })}
                    </td>
                    <td style={{ fontWeight: "bold" }}>{trade.symbol}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.1rem 0.45rem",
                          fontSize: "0.7rem",
                          fontWeight: "bold",
                          border: "1.5px solid",
                          color:
                            trade.side === "BUY"
                              ? "var(--accent-green)"
                              : "var(--accent-red)",
                          borderColor:
                            trade.side === "BUY"
                              ? "var(--accent-green)"
                              : "var(--accent-red)",
                        }}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>{trade.quantity}</td>
                    <td style={{ textAlign: "right" }}>
                      {fmtINR(trade.price, 2)}
                    </td>
                    <td style={{ textAlign: "right" }}>{fmtINR(trade.value)}</td>
                    <td style={{ textAlign: "right" }}>
                      {trade.pnl !== undefined ? (
                        <span
                          style={{
                            fontWeight: "bold",
                            color:
                              trade.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                          }}
                        >
                          {trade.pnl >= 0 ? "+" : ""}
                          {fmtINR(trade.pnl)}
                        </span>
                      ) : (
                        <span style={{ color: "#999" }}>—</span>
                      )}
                    </td>
                    <td
                      style={{
                        fontSize: "0.75rem",
                        color: "#666",
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {trade.reason ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
