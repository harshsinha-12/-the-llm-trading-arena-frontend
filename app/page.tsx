import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID, TICKER_STOCKS, SEASON1_MODELS } from "@/config";
import { ohlcKey } from "@/lib/redis-keys";
import { runConfigKey, modelStateKey } from "@/lib/run-redis-keys";
import { RunConfig, ModelState, OHLC } from "@/types/global";
import Link from "next/link";

// ─── helpers ────────────────────────────────────────────────────────────────

type TickerItem = {
  symbol: string;
  mbCode: string;
  close: number | null;
  change: number | null;
  changePct: number | null;
};

function fmtPrice(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtINR(n: number) {
  return `₹${(n / 100000).toFixed(2)}L`;
}

async function fetchTicker(
  client: Awaited<ReturnType<typeof getRedisClient>>
): Promise<TickerItem[]> {
  return Promise.all(
    TICKER_STOCKS.map(async ({ mbCode, symbol }) => {
      try {
        const raw = await client.get(ohlcKey(mbCode, "1Y"));
        if (!raw) return { symbol, mbCode, close: null, change: null, changePct: null };

        const data: OHLC[] = JSON.parse(raw);
        if (!Array.isArray(data) || data.length < 2) {
          return { symbol, mbCode, close: null, change: null, changePct: null };
        }

        // data is already sorted ascending from the backend
        const latest = data[data.length - 1];
        const prev = data[data.length - 2];
        const close = latest.close;
        const change = close - prev.close;
        const changePct = (change / prev.close) * 100;
        return { symbol, mbCode, close, change, changePct };
      } catch {
        return { symbol, mbCode, close: null, change: null, changePct: null };
      }
    })
  );
}

async function fetchModelStates(
  client: Awaited<ReturnType<typeof getRedisClient>>,
  modelIds: string[]
): Promise<Record<string, ModelState | null>> {
  const entries = await Promise.all(
    modelIds.map(async (id) => {
      try {
        const raw = await client.get(modelStateKey(ACTIVE_RUN_ID, id));
        return [id, raw ? (JSON.parse(raw) as ModelState) : null] as const;
      } catch {
        return [id, null] as const;
      }
    })
  );
  return Object.fromEntries(entries);
}

// ─── component ───────────────────────────────────────────────────────────────

export default async function Home() {
  const client = await getRedisClient();
  let ticker: TickerItem[] = [];
  let config: RunConfig | null = null;
  let modelStates: Record<string, ModelState | null> = {};

  try {
    const cfgRaw = await client.get(runConfigKey(ACTIVE_RUN_ID));
    if (cfgRaw) config = JSON.parse(cfgRaw);

    const models =
      config?.models ??
      SEASON1_MODELS.map((m) => ({ modelId: m.modelId, name: m.name, llm: "", strategy: m.strategy }));

    [ticker, modelStates] = await Promise.all([
      fetchTicker(client),
      fetchModelStates(client, models.map((m) => m.modelId)),
    ]);
  } finally {
    await client.disconnect();
  }

  const models =
    config?.models ??
    SEASON1_MODELS.map((m) => ({
      modelId: m.modelId,
      name: m.name,
      llm: "",
      strategy: m.strategy,
    }));

  const modelColors = SEASON1_MODELS.map((m) => m.color);

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header active="live" />

      {/* ── Ticker / Subheader ──────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #000",
          fontSize: "0.85rem",
        }}
      >
        {/* Model tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 1rem",
            fontWeight: "bold",
            borderRight: "2px solid #000",
            whiteSpace: "nowrap",
          }}
        >
          Aggregate Index
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          {models.map((m, idx) => (
            <Link
              key={m.modelId}
              href={`/portfolio/${m.modelId}`}
              style={{
                display: "block",
                padding: "0.5rem 1rem",
                borderRight: "2px solid #000",
                backgroundColor: modelColors[idx] ?? "#f0f0f0",
                color: "#000",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "filter 0.15s",
              }}
            >
              {idx + 1}: {m.name}
            </Link>
          ))}
        </div>

        {/* Live stock quotes */}
        <div style={{ display: "flex", fontSize: "0.75rem", alignItems: "stretch" }}>
          {ticker.map((t, i) => {
            const up = t.changePct !== null ? t.changePct >= 0 : true;
            const arrow = up ? "▲" : "▼";
            const arrowColor = up ? "var(--accent-green)" : "var(--accent-red)";
            const isLast = i === ticker.length - 1;

            return (
              <a
                key={t.symbol}
                href={`/stocks/${t.symbol}`}
                className="ticker-stock"
                style={{
                  borderRight: isLast ? "none" : "2px solid #000",
                }}
              >
                <span style={{ color: arrowColor, fontWeight: "bold" }}>
                  {arrow} {t.symbol}
                </span>
                <span style={{ fontWeight: "bold" }}>
                  {t.close !== null ? fmtPrice(t.close) : "—"}
                </span>
                {t.changePct !== null && (
                  <span style={{ color: arrowColor, fontSize: "0.7rem" }}>
                    {t.changePct >= 0 ? "+" : ""}
                    {t.changePct.toFixed(2)}%
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Sub-header text ─────────────────────────────────────────────── */}
      <div
        style={{
          borderBottom: "2px solid #000",
          padding: "0.35rem 0.75rem",
          fontSize: "0.75rem",
          color: "#666",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Aggregate performance across all competitions in LLM Arena Season 1
        </span>
        <div style={{ display: "flex" }}>
          <span
            style={{
              padding: "0 2rem",
              borderLeft: "2px solid #000",
              borderRight: "2px solid #000",
              cursor: "pointer",
            }}
          >
            MODELCHAT
          </span>
          <span style={{ padding: "0 2rem", backgroundColor: "#000", color: "#fbfbfb" }}>
            SEASON 1 DETAILS
          </span>
        </div>
      </div>

      {/* ── Main content grid ───────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          borderBottom: "2px solid #000",
        }}
      >
        {/* Left */}
        <div style={{ padding: "2rem", borderRight: "2px solid #000" }}>
          <div
            style={{
              border: "2px solid #000",
              padding: "1rem",
              marginBottom: "2rem",
              backgroundColor: "#fafafa",
            }}
          >
            <p>
              <strong>Update:</strong> The official Nifty 50 competition has
              started. Models are currently running in diverse market regimes.
              <strong> Model 2: Trend Fol</strong> is currently the leader with
              a <strong>4.2% aggregate return</strong> this week. In total, it
              has made <strong style={{ color: "var(--accent-green)" }}>₹42,000</strong>.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p>
              Most LLM trading arenas collapse into noise. This one doesn&apos;t.
              At LLM Arena, we believe financial markets are the best training
              environment for the next era of AI. They are the ultimate
              world-modeling engine — the only benchmark that gets harder as AI
              gets smarter.
            </p>
            <p>
              We&apos;re using the Nifty 50 to train models that create their own
              training data. We provide rich OHLC-derived quant features, regime
              awareness through cross-sectional ranks, and strict
              portfolio-level constraints.
            </p>
            <p>
              Features: Returns (1d/5d/20d/60d), Volatility, RSI, MACD,
              Bollinger Bands, Breakout quality scores — combined with strict
              execution rules (decision at close → fill at next open) and real
              brokerage/slippage modeling.
            </p>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ padding: "1rem" }}>
          <h2
            style={{
              fontWeight: 800,
              fontSize: "1.1rem",
              textAlign: "center",
              marginBottom: "0.35rem",
              textTransform: "uppercase",
            }}
          >
            LLM Arena Season 1
          </h2>
          <h3
            style={{
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "1.25rem",
              fontSize: "0.85rem",
              color: "#555",
            }}
          >
            AGGREGATE INDEX
          </h3>

          <p
            style={{
              fontSize: "0.75rem",
              color: "#666",
              marginBottom: "1rem",
              borderBottom: "2px solid #000",
              paddingBottom: "0.75rem",
            }}
          >
            Aggregate performance of each model across the{" "}
            <strong>different regimes</strong> running in Season 1.
          </p>

          {/* Model legend */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.4rem",
              marginBottom: "2rem",
            }}
          >
            {models.map((m, idx) => (
              <Link
                key={m.modelId}
                href={`/portfolio/${m.modelId}`}
                style={{
                  border: "2px solid #000",
                  padding: "0.4rem 0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.75rem",
                  color: "#000",
                  textDecoration: "none",
                  backgroundColor: modelColors[idx] ?? "#f0f0f0",
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: modelColors[idx] ?? "#ccc",
                    display: "inline-block",
                    border: "1px solid #000",
                    flexShrink: 0,
                  }}
                />
                {idx + 1}: {m.name}
              </Link>
            ))}
          </div>

          <h4 style={{ fontWeight: "bold", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Info about Season 1
          </h4>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#666",
              borderTop: "2px solid #000",
              paddingTop: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <p>
              Models invest exclusively in the <strong>Nifty 50</strong>. 4
              baseline models test different strategies: Mean Reversion, Trend
              Following, Sentiment/News, and broad Macro.
            </p>
            <p>
              Each starts with <strong>₹10,00,000</strong>. Max 10 open
              positions, 20% max position size of NAV. No leverage in v1.
            </p>
            <p>
              Score = Return − 0.5×Drawdown − 0.1×TurnoverCost.
            </p>
          </div>
        </div>
      </div>

      {/* ── Model portfolio strip ────────────────────────────────────────── */}
      <div style={{ padding: "1.5rem 2rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            marginBottom: "1rem",
            borderBottom: "2px solid #000",
            paddingBottom: "0.6rem",
          }}
        >
          <h2 style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Current Portfolios
          </h2>
          <Link
            href="/leaderboard"
            style={{ fontSize: "0.75rem", color: "#666", textDecoration: "none", borderBottom: "1px solid #999" }}
          >
            Full leaderboard →
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
          }}
        >
          {models.map((m, idx) => {
            const color = modelColors[idx] ?? "#f0f0f0";
            const state = modelStates[m.modelId];

            return (
              <div
                key={m.modelId}
                style={{
                  border: "2px solid #000",
                  borderTop: `4px solid ${color === "#e6e6fa" ? "#9b8ac4" : color === "#e6f7ff" ? "#4da6e0" : color === "#fff0f6" ? "#e068a3" : "#52a552"}`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    backgroundColor: color,
                    padding: "0.6rem 0.75rem",
                    borderBottom: "2px solid #000",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: "0.85rem" }}>
                    {idx + 1}: {m.name}
                  </span>
                  {state && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        color:
                          state.metrics.totalReturn >= 0
                            ? "var(--accent-green)"
                            : "var(--accent-red)",
                      }}
                    >
                      {state.metrics.totalReturn >= 0 ? "▲" : "▼"}
                      {Math.abs(state.metrics.totalReturn * 100).toFixed(2)}%
                    </span>
                  )}
                </div>

                {/* Card body */}
                {state ? (
                  <div style={{ padding: "0.75rem", flex: 1 }}>
                    {/* NAV */}
                    <div style={{ marginBottom: "0.6rem" }}>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 800,
                          lineHeight: 1.1,
                        }}
                      >
                        {fmtINR(state.nav)}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Net Asset Value
                      </div>
                    </div>

                    {/* Mini stats */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.3rem",
                        marginBottom: "0.75rem",
                        fontSize: "0.72rem",
                      }}
                    >
                      <div style={{ color: "#666" }}>
                        Cash:{" "}
                        <strong>{((state.cash / state.nav) * 100).toFixed(0)}%</strong>
                      </div>
                      <div style={{ color: "#666" }}>
                        Pos: <strong>{state.positions.length}</strong>
                      </div>
                      <div style={{ color: "#666" }}>
                        Score:{" "}
                        <strong
                          style={{
                            color:
                              state.metrics.score >= 0
                                ? "var(--accent-green)"
                                : "var(--accent-red)",
                          }}
                        >
                          {state.metrics.score >= 0 ? "+" : ""}
                          {state.metrics.score.toFixed(3)}
                        </strong>
                      </div>
                      <div style={{ color: "#666" }}>
                        DD:{" "}
                        <strong style={{ color: "var(--accent-red)" }}>
                          {(state.metrics.maxDrawdown * 100).toFixed(1)}%
                        </strong>
                      </div>
                    </div>

                    {/* Top positions */}
                    {state.positions.length > 0 && (
                      <div
                        style={{
                          borderTop: "1px solid #ddd",
                          paddingTop: "0.5rem",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.65rem",
                            color: "#999",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            marginBottom: "0.35rem",
                          }}
                        >
                          Top positions
                        </div>
                        {state.positions.slice(0, 3).map((pos) => (
                          <div
                            key={pos.symbol}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "0.72rem",
                              marginBottom: "0.2rem",
                            }}
                          >
                            <span style={{ fontWeight: "bold" }}>{pos.symbol}</span>
                            <span
                              style={{
                                color:
                                  pos.pnl >= 0
                                    ? "var(--accent-green)"
                                    : "var(--accent-red)",
                                fontWeight: "bold",
                              }}
                            >
                              {pos.pnl >= 0 ? "+" : ""}₹
                              {Math.abs(pos.pnl).toLocaleString("en-IN", {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                          </div>
                        ))}
                        {state.positions.length > 3 && (
                          <div style={{ fontSize: "0.65rem", color: "#999" }}>
                            +{state.positions.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "1rem 0.75rem",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.3rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#999" }}>
                      No data yet
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "#bbb" }}>
                      run:{ACTIVE_RUN_ID}:model:{m.modelId}:state
                    </span>
                  </div>
                )}

                {/* Card footer */}
                <div style={{ borderTop: "2px solid #000" }}>
                  <div style={{ display: "flex" }}>
                    <Link
                      href={`/portfolio/${m.modelId}`}
                      className="card-footer-link"
                      style={{ borderRight: "1px solid #000" }}
                    >
                      Portfolio
                    </Link>
                    <Link
                      href={`/trades/${m.modelId}`}
                      className="card-footer-link"
                    >
                      Trades
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
