"use client";

import { useState } from "react";

type Props = {
    runId: string;
    modelId: string;
    modelColor: string;
};

type DecisionResult = {
    orders: { symbol: string; action: string; quantity: number }[];
    confidence: number;
    rationale: string;
};

export default function TriggerDecisionButton({ runId, modelId, modelColor }: Props) {
    const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [result, setResult] = useState<DecisionResult | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    async function trigger() {
        setState("loading");
        setResult(null);
        setErrorMsg("");
        try {
            const res = await fetch(`/api/runs/${runId}/models/${modelId}/decide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            const data: DecisionResult = await res.json();
            setResult(data);
            setState("done");
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : "Unknown error");
            setState("error");
        }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <button
                onClick={trigger}
                disabled={state === "loading"}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    border: "2px solid #000",
                    padding: "0.3rem 0.85rem",
                    fontSize: "0.78rem",
                    fontWeight: "bold",
                    color: "#000",
                    backgroundColor: state === "loading" ? "#e0e0e0" : modelColor,
                    cursor: state === "loading" ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s",
                }}
            >
                {state === "loading" ? "⏳ Running…" : "▶ Run GPT-5.5"}
            </button>

            {state === "done" && result && (
                <div
                    style={{
                        position: "fixed",
                        bottom: "1.25rem",
                        right: "1.25rem",
                        border: "2px solid #000",
                        backgroundColor: "#fff",
                        padding: "1rem",
                        maxWidth: "340px",
                        boxShadow: "4px 4px 0 #000",
                        zIndex: 100,
                        fontSize: "0.8rem",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <strong>Decision complete</strong>
                        <button
                            onClick={() => setState("idle")}
                            style={{ border: "none", background: "none", cursor: "pointer", fontWeight: "bold" }}
                        >
                            ✕
                        </button>
                    </div>
                    <p style={{ color: "#555", marginBottom: "0.5rem", lineHeight: 1.4 }}>
                        {result.rationale}
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                        {result.orders.length === 0 ? (
                            <span style={{ color: "#999" }}>No orders — hold.</span>
                        ) : (
                            result.orders.map((o, i) => (
                                <span
                                    key={i}
                                    style={{
                                        border: "1.5px solid",
                                        padding: "0.1rem 0.4rem",
                                        fontSize: "0.72rem",
                                        fontWeight: "bold",
                                        color: o.action === "BUY" ? "var(--accent-green)" : o.action === "SELL" ? "var(--accent-red)" : "#666",
                                        borderColor: o.action === "BUY" ? "var(--accent-green)" : o.action === "SELL" ? "var(--accent-red)" : "#666",
                                    }}
                                >
                                    {o.action} {o.symbol} ×{o.quantity}
                                </span>
                            ))
                        )}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#666" }}>
                        Confidence: <strong>{Math.round(result.confidence * 100)}%</strong>
                        &nbsp;·&nbsp;
                        <a
                            href={`/models/${modelId}`}
                            style={{ color: "#000", textDecoration: "underline", cursor: "pointer" }}
                            onClick={() => { setState("idle"); window.location.reload(); }}
                        >
                            Refresh page to see reasoning →
                        </a>
                    </div>
                </div>
            )}

            {state === "error" && (
                <p style={{ fontSize: "0.72rem", color: "var(--accent-red)", maxWidth: "220px" }}>
                    Error: {errorMsg}
                </p>
            )}
        </div>
    );
}
