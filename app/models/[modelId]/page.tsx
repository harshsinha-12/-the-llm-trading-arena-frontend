import Header from "@/app/components/Header";
import ModelTabs, { ModelTabItem } from "@/app/components/ModelTabs";
import TriggerDecisionButton from "@/app/components/TriggerDecisionButton";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID, SEASON1_MODELS } from "@/config";
import { modelTradesKey, modelOrdersKey, runConfigKey } from "@/lib/run-redis-keys";
import { Trade, RunConfig } from "@/types/global";
import Link from "next/link";
import { getModelIdReadCandidates, normalizeModelId, normalizeRunConfig } from "@/lib/model-id";

// ─── types ────────────────────────────────────────────────────────────────────

type DecisionOrder = {
    symbol: string;
    action: "BUY" | "SELL" | "HOLD";
    quantity: number;
    rationale: string;
};

type DecisionEntry = {
    decidedAt: string;
    modelId: string;
    orders: DecisionOrder[];
    risk_controls: {
        maxNewPositions?: number;
        stopLossSymbols?: string[];
        profitTargetSymbols?: string[];
    };
    rationale: string;
    confidence: number;
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtINR(val: number, decimals = 0) {
    return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: decimals })}`;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
    });
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
        hour12: false,
    });
}

function confidenceColor(c: number) {
    if (c >= 0.75) return "var(--accent-green)";
    if (c >= 0.5) return "#f59e0b";
    return "var(--accent-red)";
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

async function readFirstModelList(
    client: Awaited<ReturnType<typeof getRedisClient>>,
    modelIds: string[],
    keyFor: (modelId: string) => string
): Promise<string[]> {
    for (const modelId of modelIds) {
        const items = await client.lRange(keyFor(modelId), -8, -1);
        if (items.length > 0) return items;
    }
    return [];
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ModelPage({
    params,
}: {
    params: Promise<{ modelId: string }>;
}) {
    const { modelId: requestedModelId } = await params;
    const modelId = normalizeModelId(requestedModelId);
    const client = await getRedisClient();

    let trades: Trade[] = [];
    let config: RunConfig | null = null;
    let decisions: DecisionEntry[] = [];

    try {
        const modelIdCandidates = getModelIdReadCandidates(modelId);
        const [tradesRaw, cfgRaw, decisionItems] = await Promise.all([
            readFirstModelValue(client, modelIdCandidates, (candidate) => modelTradesKey(ACTIVE_RUN_ID, candidate)),
            client.get(runConfigKey(ACTIVE_RUN_ID)),
            // Get the 8 most recent decisions from the Redis list (newest last → reverse below)
            readFirstModelList(client, modelIdCandidates, (candidate) => modelOrdersKey(ACTIVE_RUN_ID, candidate)),
        ]);

        if (tradesRaw) trades = JSON.parse(tradesRaw);
        if (cfgRaw) config = normalizeRunConfig(JSON.parse(cfgRaw));

        decisions = decisionItems
            .map((raw) => {
                try { return JSON.parse(raw) as DecisionEntry; }
                catch { return null; }
            })
            .filter((d): d is DecisionEntry => d !== null)
            .reverse(); // newest first
    } finally {
        await client.disconnect();
    }

    // Build model tab items with colors from SEASON1_MODELS fallback
    const configModels = config?.models ?? SEASON1_MODELS.map((m) => ({ modelId: m.modelId, name: m.name, llm: "", strategy: m.strategy }));
    const tabModels: ModelTabItem[] = configModels.map((m, idx) => ({
        modelId: m.modelId,
        name: m.name,
        color: SEASON1_MODELS[idx]?.color ?? "#f0f0f0",
    }));

    const modelConfig = configModels.find((m) => m.modelId === modelId);
    const modelName = modelConfig?.name ?? modelId;
    const modelIdx = configModels.findIndex((m) => m.modelId === modelId);
    const modelColor = SEASON1_MODELS[modelIdx >= 0 ? modelIdx : 0]?.color ?? "#f0f0f0";

    // Trade summary stats
    const sorted = [...trades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const buys = trades.filter((t) => t.side === "BUY").length;
    const sells = trades.filter((t) => t.side === "SELL").length;
    const closed = trades.filter((t) => t.pnl !== undefined);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const winners = closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const winRate = closed.length > 0 ? ((winners / closed.length) * 100).toFixed(0) + "%" : "—";

    return (
        <main className="landing-page">
            <Header active="docs" />

            {/* Model tab row */}
            <ModelTabs models={tabModels} active={modelId} />

            {/* Sub-header */}
            <div className="landing-terminal__header" style={{ justifyContent: "flex-start", gap: "16px", borderTop: "0", background: "var(--landing-surface)", color: "var(--landing-line)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "12px", height: "12px", border: "1px solid var(--landing-line)", background: "transparent", display: "inline-block" }} />
                    <span style={{ fontWeight: 800, fontFamily: "var(--font-mono), monospace", fontSize: "10px" }}>{modelName.toUpperCase()}</span>
                </span>
                <span style={{ color: "var(--landing-line)", fontWeight: 800, fontSize: "10px" }}>|</span>
                <span style={{ color: "var(--landing-line)", fontWeight: 800, fontSize: "10px", fontFamily: "var(--font-mono), monospace" }}>TRADES</span>
                <span style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TriggerDecisionButton
                        runId={ACTIVE_RUN_ID}
                        modelId={modelId}
                        modelColor={"var(--landing-surface)"}
                    />
                    <Link
                        href={`/portfolio/${modelId}`}
                        className="landing-button"
                        style={{ height: "28px", padding: "0 12px", background: "var(--landing-purple)", fontWeight: 800 }}
                    >
                        VIEW PORTFOLIO →
                    </Link>
                </div>
            </div>

            {/* Main layout: trades | reasoning sidebar */}
            <section className="landing-section" style={{ padding: 0 }}>
                <div className="arena-shell-grid" style={{ minHeight: "calc(100vh - 145px)" }}>
                    
                    {/* ── Left: trades ─────────────────────────────────────── */}
                    <div className="arena-main-panel" style={{ padding: "32px", overflowX: "auto" }}>
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
                                <div key={label} style={{ background: "var(--landing-surface)", border: "1px solid var(--landing-line)", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ fontSize: "24px", fontWeight: 800, color: color ?? "var(--landing-line)" }}>{value}</div>
                                    <div style={{ fontSize: "10px", color: "var(--landing-line)", fontWeight: 800, fontFamily: "var(--font-mono), monospace" }}>{label}</div>
                                </div>
                            ))}
                        </div>

                        {sorted.length === 0 ? (
                            <div className="landing-coming-soon" style={{ margin: "0 auto", minHeight: "200px" }}>
                                <strong>NO TRADES YET</strong>
                                <span>Trigger a decision via <code>POST /api/runs/{ACTIVE_RUN_ID}/models/{modelId}/decide</code></span>
                                <span style={{ marginTop: "16px" }}>Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:trades</code></span>
                            </div>
                        ) : (
                            <div className="landing-dashboard arena-table-scroll arena-table-scroll--wide">
                                <div className="landing-leaderboard__head" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1.5fr 1.5fr 3fr", padding: "0 16px" }}>
                                    <span style={{ textAlign: "left" }}>DATE</span>
                                    <span style={{ textAlign: "left" }}>SYMBOL</span>
                                    <span style={{ textAlign: "left" }}>SIDE</span>
                                    <span style={{ textAlign: "right" }}>QTY</span>
                                    <span style={{ textAlign: "right" }}>PRICE</span>
                                    <span style={{ textAlign: "right" }}>VALUE</span>
                                    <span style={{ textAlign: "right" }}>P&amp;L</span>
                                    <span style={{ textAlign: "left", paddingLeft: "16px" }}>REASON</span>
                                </div>
                                <div className="landing-leaderboard" style={{ minHeight: "auto", border: 0, borderTop: "1px solid var(--landing-line)" }}>
                                    {sorted.map((trade) => (
                                        <div key={trade.tradeId} className="landing-leaderboard__row" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1.5fr 1.5fr 3fr", padding: "0 16px" }}>
                                            <span style={{ color: "var(--landing-muted)", fontSize: "12px", justifyContent: "flex-start" }}>
                                                {fmtDate(trade.date)}
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
                                            <span
                                                title={trade.reason ?? "No reason recorded"}
                                                style={{ fontSize: "12px", color: "var(--landing-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", justifyContent: "flex-start", paddingLeft: "16px" }}
                                            >
                                                {trade.reason ?? "—"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right: reasoning sidebar ─────────────────────────── */}
                    <div className="arena-sidebar-panel arena-sidebar-panel--low" style={{ padding: "32px", overflowY: "auto" }}>
                        <h3 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "16px", fontFamily: "var(--font-mono), monospace" }}>
                            {modelName.toUpperCase()} REASONING
                        </h3>
                        <hr style={{ border: 0, borderTop: "1px solid var(--landing-line)", marginBottom: "32px" }} />

                        {decisions.length === 0 ? (
                            <div style={{ 
                                background: "var(--landing-surface)", 
                                border: "1px solid var(--landing-line)", 
                                boxShadow: "4px 4px 0 0 var(--landing-line)",
                                padding: "48px 24px",
                                textAlign: "center",
                                minHeight: "150px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <span style={{ fontSize: "12px", fontFamily: "var(--font-mono), monospace" }}>No decisions yet.</span>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                {decisions.map((d, i) => (
                                    <div key={i} className="landing-mini-card" style={{ background: i === 0 ? modelColor : "var(--landing-surface)", padding: 0 }}>
                                        {/* Decision header */}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--landing-line)" }}>
                                            <span style={{ color: "var(--landing-muted)", fontSize: "10px", fontWeight: 700 }}>
                                                {fmtDate(d.decidedAt)} {fmtTime(d.decidedAt)}
                                            </span>
                                            <span style={{ fontWeight: 800, color: confidenceColor(d.confidence), fontSize: "10px" }}>
                                                {Math.round(d.confidence * 100)}% conf
                                            </span>
                                        </div>

                                        {/* Rationale */}
                                        <div style={{ padding: "12px", borderBottom: "1px solid var(--landing-line)" }}>
                                            <p style={{ fontSize: "12px", color: "var(--landing-line)", lineHeight: 1.5 }}>
                                                {d.rationale}
                                            </p>
                                        </div>

                                        {/* Orders */}
                                        {d.orders.length > 0 ? (
                                            <div style={{ padding: "8px 12px" }}>
                                                {d.orders.map((o, oi) => (
                                                    <div key={oi} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: oi < d.orders.length - 1 ? "8px" : 0, fontSize: "12px" }}>
                                                        <span style={{
                                                            display: "inline-block", padding: "2px 6px", fontSize: "10px", fontWeight: 800, border: "1px solid", flexShrink: 0,
                                                            color: o.action === "BUY" ? "var(--accent-green)" : o.action === "SELL" ? "var(--accent-red)" : "var(--landing-muted)",
                                                            borderColor: o.action === "BUY" ? "var(--accent-green)" : o.action === "SELL" ? "var(--accent-red)" : "var(--landing-muted)",
                                                        }}>
                                                            {o.action}
                                                        </span>
                                                        <span>
                                                            <strong>{o.symbol}</strong> <span style={{ color: "var(--landing-muted)" }}>×{o.quantity}</span>
                                                            {o.rationale && (
                                                                <span style={{ display: "block", fontSize: "10px", color: "var(--landing-muted)", marginTop: "4px", lineHeight: 1.4 }}>
                                                                    {o.rationale}
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ padding: "8px 12px" }}>
                                                <span style={{ fontSize: "12px", color: "var(--landing-muted)" }}>No orders — hold.</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
