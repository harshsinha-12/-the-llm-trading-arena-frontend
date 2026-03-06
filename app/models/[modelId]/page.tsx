import Header from "@/app/components/Header";
import ModelTabs, { ModelTabItem } from "@/app/components/ModelTabs";
import TriggerDecisionButton from "@/app/components/TriggerDecisionButton";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID, SEASON1_MODELS } from "@/config";
import { modelTradesKey, modelOrdersKey, runConfigKey } from "@/lib/run-redis-keys";
import { Trade, RunConfig } from "@/types/global";
import Link from "next/link";

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

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ModelPage({
    params,
}: {
    params: Promise<{ modelId: string }>;
}) {
    const { modelId } = await params;
    const client = await getRedisClient();

    let trades: Trade[] = [];
    let config: RunConfig | null = null;
    let decisions: DecisionEntry[] = [];

    try {
        const [tradesRaw, cfgRaw, decisionItems] = await Promise.all([
            client.get(modelTradesKey(ACTIVE_RUN_ID, modelId)),
            client.get(runConfigKey(ACTIVE_RUN_ID)),
            // Get the 8 most recent decisions from the Redis list (newest last → reverse below)
            client.lRange(modelOrdersKey(ACTIVE_RUN_ID, modelId), -8, -1),
        ]);

        if (tradesRaw) trades = JSON.parse(tradesRaw);
        if (cfgRaw) config = JSON.parse(cfgRaw);

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
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <Header active="live" />

            {/* Model tab row */}
            <ModelTabs models={tabModels} active={modelId} />

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
                <span style={{ color: "#666", fontSize: "0.8rem" }}>TRADES</span>
                <span style={{ flex: 1 }} />
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <TriggerDecisionButton
                        runId={ACTIVE_RUN_ID}
                        modelId={modelId}
                        modelColor={modelColor}
                    />
                    <Link
                        href={`/portfolio/${modelId}`}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            border: "2px solid #000",
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.78rem",
                            fontWeight: "bold",
                            color: "#000",
                            textDecoration: "none",
                            backgroundColor: modelColor,
                        }}
                    >
                        VIEW PORTFOLIO →
                    </Link>
                </div>
            </div>

            {/* Main layout: trades | reasoning sidebar */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 320px",
                    flex: 1,
                    minHeight: 0,
                }}
            >
                {/* ── Left: trades ─────────────────────────────────────── */}
                <div style={{ borderRight: "2px solid #000", padding: "1.25rem 1.5rem", overflowX: "auto" }}>
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
                                <div className="stat-value" style={{ color: color ?? "#000" }}>{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>

                    {sorted.length === 0 ? (
                        <div className="empty-state">
                            <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>NO TRADES YET</p>
                            <p style={{ fontSize: "0.8rem", color: "#666" }}>
                                Trigger a decision via <code>POST /api/runs/{ACTIVE_RUN_ID}/models/{modelId}/decide</code>
                            </p>
                            <p style={{ fontSize: "0.75rem", color: "#999", marginTop: "0.5rem" }}>
                                Redis key: <code>run:{ACTIVE_RUN_ID}:model:{modelId}:trades</code>
                            </p>
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>DATE</th>
                                    <th>SYMBOL</th>
                                    <th>SIDE</th>
                                    <th style={{ textAlign: "right" }}>QTY</th>
                                    <th style={{ textAlign: "right" }}>PRICE</th>
                                    <th style={{ textAlign: "right" }}>VALUE</th>
                                    <th style={{ textAlign: "right" }}>P&amp;L</th>
                                    <th>REASON</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map((trade) => (
                                    <tr key={trade.tradeId}>
                                        <td style={{ whiteSpace: "nowrap", color: "#666", fontSize: "0.8rem" }}>
                                            {fmtDate(trade.date)}
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
                                                    color: trade.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)",
                                                    borderColor: trade.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)",
                                                }}
                                            >
                                                {trade.side}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right" }}>{trade.quantity}</td>
                                        <td style={{ textAlign: "right" }}>{fmtINR(trade.price, 2)}</td>
                                        <td style={{ textAlign: "right" }}>{fmtINR(trade.value)}</td>
                                        <td style={{ textAlign: "right" }}>
                                            {trade.pnl !== undefined ? (
                                                <span
                                                    style={{
                                                        fontWeight: "bold",
                                                        color: trade.pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                                                    }}
                                                >
                                                    {trade.pnl >= 0 ? "+" : ""}{fmtINR(trade.pnl)}
                                                </span>
                                            ) : (
                                                <span style={{ color: "#999" }}>—</span>
                                            )}
                                        </td>
                                        <td
                                            style={{
                                                fontSize: "0.75rem",
                                                color: "#666",
                                                maxWidth: "180px",
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
                    )}
                </div>

                {/* ── Right: reasoning sidebar ─────────────────────────── */}
                <div style={{ padding: "1.25rem", overflowY: "auto" }}>
                    <p
                        style={{
                            fontSize: "0.7rem",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            marginBottom: "1rem",
                            borderBottom: "2px solid #000",
                            paddingBottom: "0.5rem",
                        }}
                    >
                        GPT-5.2 Reasoning
                    </p>

                    {decisions.length === 0 ? (
                        <div className="empty-state" style={{ padding: "1.5rem 1rem" }}>
                            <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "0.4rem" }}>
                                No decisions yet.
                            </p>
                            <p style={{ fontSize: "0.72rem", color: "#999" }}>
                                Trigger via <code style={{ fontSize: "0.68rem" }}>POST /api/runs/…/decide</code>
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {decisions.map((d, i) => (
                                <div
                                    key={i}
                                    style={{
                                        border: "2px solid #000",
                                        backgroundColor: i === 0 ? modelColor : "#fafafa",
                                    }}
                                >
                                    {/* Decision header */}
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            padding: "0.45rem 0.6rem",
                                            borderBottom: "1.5px solid #000",
                                            fontSize: "0.72rem",
                                        }}
                                    >
                                        <span style={{ color: "#555" }}>
                                            {fmtDate(d.decidedAt)} {fmtTime(d.decidedAt)}
                                        </span>
                                        <span
                                            style={{
                                                fontWeight: "bold",
                                                color: confidenceColor(d.confidence),
                                                fontSize: "0.75rem",
                                            }}
                                        >
                                            {Math.round(d.confidence * 100)}% conf
                                        </span>
                                    </div>

                                    {/* Rationale */}
                                    <div style={{ padding: "0.6rem", borderBottom: "1.5px solid #000" }}>
                                        <p style={{ fontSize: "0.75rem", color: "#333", lineHeight: 1.5 }}>
                                            {d.rationale}
                                        </p>
                                    </div>

                                    {/* Orders */}
                                    {d.orders.length > 0 ? (
                                        <div style={{ padding: "0.5rem 0.6rem" }}>
                                            {d.orders.map((o, oi) => (
                                                <div
                                                    key={oi}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "flex-start",
                                                        gap: "0.4rem",
                                                        marginBottom: oi < d.orders.length - 1 ? "0.45rem" : 0,
                                                        fontSize: "0.75rem",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            display: "inline-block",
                                                            padding: "0.05rem 0.35rem",
                                                            fontSize: "0.65rem",
                                                            fontWeight: "bold",
                                                            border: "1.5px solid",
                                                            flexShrink: 0,
                                                            color:
                                                                o.action === "BUY"
                                                                    ? "var(--accent-green)"
                                                                    : o.action === "SELL"
                                                                    ? "var(--accent-red)"
                                                                    : "#666",
                                                            borderColor:
                                                                o.action === "BUY"
                                                                    ? "var(--accent-green)"
                                                                    : o.action === "SELL"
                                                                    ? "var(--accent-red)"
                                                                    : "#666",
                                                        }}
                                                    >
                                                        {o.action}
                                                    </span>
                                                    <span>
                                                        <strong>{o.symbol}</strong>{" "}
                                                        <span style={{ color: "#666" }}>×{o.quantity}</span>
                                                        {o.rationale && (
                                                            <span
                                                                style={{
                                                                    display: "block",
                                                                    fontSize: "0.68rem",
                                                                    color: "#888",
                                                                    marginTop: "0.1rem",
                                                                    lineHeight: 1.4,
                                                                }}
                                                            >
                                                                {o.rationale}
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: "0.5rem 0.6rem" }}>
                                            <span style={{ fontSize: "0.72rem", color: "#999" }}>No orders — hold.</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
