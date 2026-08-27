import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { modelTradesKey, runConfigKey } from "@/lib/run-redis-keys";
import { Trade, RunConfig } from "@/types/global";
import Link from "next/link";
import { getModelIdReadCandidates, normalizeModelId, normalizeRunConfig } from "@/lib/model-id";
import TriggerDecisionButton from "@/app/components/TriggerDecisionButton";

const MODEL_COLORS = ["#d7d7fd", "#d7f5d0", "#ffebeb", "#f3f3f3"];

function fmtINR(val: number, decimals = 0) {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: decimals })}`;
}

async function readFirstModelValue(
  client: Awaited<ReturnType<typeof getRedisClient>>,
  modelIds: string[],
  keyFor: (modelId: string) => string
): Promise<string | null> {
  for (const modelId of modelIds) {
    const raw = await client.get(keyFor(modelId));
    if (raw !== null) return raw;
  }
  return null;
}

export default async function TradesPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId: requestedModelId } = await params;
  const modelId = normalizeModelId(requestedModelId);
  const client = await getRedisClient();
  let trades: Trade[] = [];
  let config: RunConfig | null = null;

  try {
    const [tradesRaw, cfgRaw] = await Promise.all([
      readFirstModelValue(client, getModelIdReadCandidates(modelId), (candidate) => modelTradesKey(ACTIVE_RUN_ID, candidate)),
      client.get(runConfigKey(ACTIVE_RUN_ID)),
    ]);
    if (tradesRaw) trades = JSON.parse(tradesRaw);
    if (cfgRaw) config = normalizeRunConfig(JSON.parse(cfgRaw));
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
    <main className="landing-page">
      <Header active="trades" />

      {/* Sub-header */}
      <div className="landing-terminal__header" style={{ justifyContent: "flex-start", gap: "16px", borderTop: "0", background: "var(--landing-surface)", color: "var(--landing-line)" }}>
        <Link href={`/portfolio/${modelId}`} style={{ color: "var(--landing-muted)", textDecoration: "none" }}>
          ← PORTFOLIO
        </Link>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <i style={{ width: "12px", height: "12px", background: modelColor, border: "1px solid var(--landing-line)", display: "inline-block" }} />
          <span style={{ fontWeight: 800 }}>{modelName.toUpperCase()}</span>
        </span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--landing-muted)" }}>TRADE HISTORY</span>
        <span style={{ flex: 1 }} />
        <TriggerDecisionButton
          runId={ACTIVE_RUN_ID}
          modelId={modelId}
          modelColor={"var(--landing-surface)"}
        />
      </div>

      <section className="landing-section">
        <div className="landing-section__inner">
          {/* Summary stats */}
          <div className="arena-stat-grid arena-stat-grid--4" style={{ marginBottom: "32px" }}>
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
              <div className="landing-mini-card" key={label} style={{ background: "var(--landing-surface)" }}>
                <div style={{ fontSize: "24px", fontWeight: 800, color: color ?? "var(--landing-line)" }}>
                  {value}
                </div>
                <div style={{ fontSize: "10px", color: "var(--landing-muted)", fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>

          {sorted.length === 0 ? (
            <div className="landing-coming-soon" style={{ margin: "0 auto" }}>
              <strong>NO TRADES YET</strong>
              <span>Run the trading engine to generate trades.</span>
              <span style={{ marginTop: "16px" }}>Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:trades</code></span>
            </div>
          ) : (
            <div className="landing-dashboard arena-table-scroll arena-table-scroll--wide">
              <div className="landing-leaderboard__head" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr 1.5fr 1.5fr 3fr", padding: "0 16px" }}>
                <span style={{ textAlign: "left" }}>DATE</span>
                <span style={{ textAlign: "left" }}>SYMBOL</span>
                <span style={{ textAlign: "left" }}>SIDE</span>
                <span style={{ textAlign: "right" }}>QTY</span>
                <span style={{ textAlign: "right" }}>PRICE</span>
                <span style={{ textAlign: "right" }}>VALUE</span>
                <span style={{ textAlign: "right" }}>P&L</span>
                <span style={{ textAlign: "left", paddingLeft: "16px" }}>REASON</span>
              </div>
              
              <div className="landing-leaderboard" style={{ minHeight: "auto", border: 0, borderTop: "1px solid var(--landing-line)" }}>
                {sorted.map((trade) => (
                  <div key={trade.tradeId} className="landing-leaderboard__row" style={{ gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.5fr 1.5fr 1.5fr 3fr", padding: "0 16px" }}>
                    <span style={{ color: "var(--landing-muted)", fontSize: "12px", justifyContent: "flex-start" }}>
                      {new Date(trade.date).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
                      })}
                    </span>
                    <strong style={{ justifyContent: "flex-start" }}>{trade.symbol}</strong>
                    <span style={{ justifyContent: "flex-start" }}>
                      <span style={{
                        display: "inline-block", padding: "2px 6px", fontSize: "10px", fontWeight: 800,
                        border: "1px solid", color: trade.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)",
                        borderColor: trade.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)",
                      }}>
                        {trade.side}
                      </span>
                    </span>
                    <span style={{ textAlign: "right" }}>{trade.quantity}</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>{fmtINR(trade.price, 2)}</span>
                    <span style={{ textAlign: "right", fontWeight: 700 }}>{fmtINR(trade.value)}</span>
                    <span style={{ textAlign: "right" }}>
                      {trade.pnl !== undefined ? (
                        <span style={{ fontWeight: 800, color: trade.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                          {trade.pnl >= 0 ? "+" : ""}{fmtINR(trade.pnl)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--landing-muted)" }}>—</span>
                      )}
                    </span>
                    <span className="arena-reason-cell">
                      <span className="arena-reason-cell__text">{trade.reason ?? "—"}</span>
                      {trade.reason && (
                        <span className="arena-reason-cell__tooltip">
                          {trade.reason}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
