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
                <div className="arena-decision-popover">
                    <div className="arena-decision-popover__title">
                        <strong>Decision complete</strong>
                        <button
                            onClick={() => setState("idle")}
                            className="arena-decision-popover__close"
                            aria-label="Close decision summary"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="arena-decision-popover__rationale">
                        {result.rationale}
                    </p>
                    <div className="arena-decision-popover__orders">
                        {result.orders.length === 0 ? (
                            <span className="arena-decision-popover__order">No orders — hold.</span>
                        ) : (
                            result.orders.map((o, i) => (
                                <span
                                    key={i}
                                    className={`arena-decision-popover__order ${o.action === "BUY" ? "is-buy" : o.action === "SELL" ? "is-sell" : ""}`}
                                >
                                    {o.action} {o.symbol} ×{o.quantity}
                                </span>
                            ))
                        )}
                    </div>
                    <div className="arena-decision-popover__footer">
                        <span>Confidence: <strong>{Math.round(result.confidence * 100)}%</strong></span>
                        <a
                            href={`/models/${modelId}`}
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
