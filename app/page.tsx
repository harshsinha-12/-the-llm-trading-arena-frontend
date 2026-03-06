import Header from "@/app/components/Header";
import ModelTabs, { ModelTabItem } from "@/app/components/ModelTabs";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID, TICKER_STOCKS, SEASON1_MODELS } from "@/config";
import { ohlcKey } from "@/lib/redis-keys";
import { runConfigKey } from "@/lib/run-redis-keys";
import { RunConfig, OHLC } from "@/types/global";
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

// ─── component ───────────────────────────────────────────────────────────────

export default async function Home() {
  const client = await getRedisClient();
  let ticker: TickerItem[] = [];
  let config: RunConfig | null = null;

  try {
    const cfgRaw = await client.get(runConfigKey(ACTIVE_RUN_ID));
    if (cfgRaw) config = JSON.parse(cfgRaw);
    ticker = await fetchTicker(client);
  } finally {
    await client.disconnect();
  }

  const configModels =
    config?.models ??
    SEASON1_MODELS.map((m) => ({ modelId: m.modelId, name: m.name, llm: "", strategy: m.strategy }));

  const tabModels: ModelTabItem[] = configModels.map((m, idx) => ({
    modelId: m.modelId,
    name: m.name,
    color: SEASON1_MODELS[idx]?.color ?? "#f0f0f0",
  }));

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header active="live" />

      {/* ── Model tabs ──────────────────────────────────────────────────── */}
      <ModelTabs models={tabModels} active={null} />

      {/* ── Ticker bar ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #000",
          fontSize: "0.75rem",
          overflowX: "auto",
        }}
      >
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
              style={{ borderRight: isLast ? "none" : "2px solid #000" }}
            >
              <span style={{ color: arrowColor, fontWeight: "bold" }}>
                {arrow} {t.symbol}
              </span>
              <span style={{ fontWeight: "bold" }}>
                {t.close !== null ? fmtPrice(t.close) : "—"}
              </span>
              {t.changePct !== null && (
                <span style={{ color: arrowColor }}>
                  {t.changePct >= 0 ? "+" : ""}{t.changePct.toFixed(2)}%
                </span>
              )}
            </a>
          );
        })}
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
            {tabModels.map((m, idx) => (
              <Link
                key={m.modelId}
                href={`/models/${m.modelId}`}
                style={{
                  border: "2px solid #000",
                  padding: "0.4rem 0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.75rem",
                  color: "#000",
                  textDecoration: "none",
                  backgroundColor: m.color,
                }}
              >
                <span
                  style={{
                    width: "10px",
                    height: "10px",
                    backgroundColor: m.color,
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

    </main>
  );
}
