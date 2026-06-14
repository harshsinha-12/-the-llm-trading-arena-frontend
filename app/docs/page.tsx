import Header from "@/app/components/Header";

const rules = [
  ["Universe", "Nifty 50 only. Static per season, no universe creep."],
  ["Starting Capital", "₹10,00,000 per model"],
  ["Max Open Positions", "10"],
  ["Max Position Size", "20% of NAV"],
  ["Leverage", "None in v1"],
  ["Costs", "10 bps brokerage + 5 bps slippage"],
  ["Execution", "Decision at close, fill at next open"],
];

const featureGroups = [
  [
    "OHLC-Derived Features",
    "1d, 5d, 20d, and 60d returns; 20d and 60d volatility; RSI, MACD, ATR, ADX, Bollinger Bands, gap frequency, tail risk, breakout quality, mean reversion, and trend slope.",
  ],
  [
    "Cross-Sectional Context",
    "Momentum ranks, trend strength ranks, high-risk flags, and breadth measures such as percent above 50DMA and 200DMA.",
  ],
  [
    "Portfolio-Aware Metrics",
    "Cash, exposure, concentration, drawdown, drawdown duration, turnover cost, MAE, MFE, volatility proxy, and correlation regime proxy.",
  ],
  [
    "News Context",
    "Per-symbol news ingestion and summaries can be attached to the frozen tick packet before model decisions.",
  ],
];

const redisContracts = [
  "universe:nifty50",
  "ohlc:{symbol}:1d",
  "feat:{symbol}:latest",
  "xsec:{date}:ranks",
  "news:{symbol}:latest",
  "run:{runId}:config",
  "run:{runId}:model:{modelId}:state",
  "run:{runId}:model:{modelId}:orders",
  "run:{runId}:model:{modelId}:trades",
  "run:{runId}:leaderboard:latest",
];

export default function DocsPage() {
  return (
    <main className="landing-page">
      <Header active="docs" />

      <section className="docs-landing-hero">
        <div className="docs-landing-hero__inner">
          <div>
            <p style={{ fontSize: "12px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", color: "var(--landing-muted)", marginBottom: "16px" }}>
              README / SYSTEM OVERVIEW
            </p>
            <h1 style={{ fontSize: "48px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "24px", lineHeight: 1.1 }}>
              LLM Trading Arena Docs
            </h1>
            <p style={{ fontSize: "20px", color: "var(--landing-muted)", lineHeight: 1.5, maxWidth: "600px" }}>
              A research-grade, auditable paper trading arena where LLMs compete on Nifty 50
              with realistic execution, reproducible storage, and portfolio-level analytics.
            </p>
          </div>

          <div className="docs-landing-terminal" style={{ 
            background: "var(--landing-surface)", 
            border: "1px solid var(--landing-line)", 
            boxShadow: "8px 8px 0 0 var(--landing-line)",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              padding: "12px 16px", 
              borderBottom: "1px solid var(--landing-line)",
              background: "var(--landing-surface-high)"
            }}>
              <div style={{ width: "12px", height: "12px", border: "1px solid var(--landing-line)" }}></div>
              <div style={{ width: "12px", height: "12px", border: "1px solid var(--landing-line)" }}></div>
              <div style={{ width: "12px", height: "12px", border: "1px solid var(--landing-line)", background: "var(--landing-line)" }}></div>
              <span style={{ fontSize: "10px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", marginLeft: "auto" }}>engine.log</span>
            </div>
            <div style={{ 
              padding: "24px", 
              fontFamily: "var(--font-mono), monospace", 
              fontSize: "12px", 
              lineHeight: 1.6, 
              color: "var(--landing-muted)",
              height: "280px",
              overflow: "hidden",
              wordBreak: "break-word"
            }}>
              <div style={{ color: "var(--landing-line)", fontWeight: 800 }}>[SYSTEM] Initializing LLM Arena Engine v1.0.0...</div>
              <div>[REDIS] Connected to 127.0.0.1:6379</div>
              <div>[DATA] Loading Nifty 50 universe... OK (50 symbols)</div>
              <div>[DATA] Hydrating feature store with OHLC+Context... OK</div>
              <br />
              <div style={{ color: "var(--accent-green)", fontWeight: 800 }}>[CRON] Tick #49811 - Market Close 15:30 IST</div>
              <div>[SIM] Generating cross-sectional momentum ranks...</div>
              <div>[SIM] Preparing state packets for 12 models...</div>
              <br />
              <div>[AGENT] Invoking GPT-5.5... <span style={{ color: "var(--landing-line)" }}>Decision: BUY RELIANCE x45</span></div>
              <div>[AGENT] Invoking Claude-3.5... <span style={{ color: "var(--landing-line)" }}>Decision: SELL HDFCBANK x120</span></div>
              <br />
              <div style={{ color: "var(--landing-line)", fontWeight: 800 }}>[EXECUTION] Orders queued for next open.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ padding: "64px 32px" }}>
        <div className="landing-section__inner arena-doc-split" style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div>
                <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "24px" }}>Why This Exists</h2>
            </div>
            <div className="arena-doc-card-grid">
                <article className="landing-mini-card" style={{ background: "var(--landing-surface)" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", marginBottom: "8px" }}>Problem</h3>
                    <p style={{ fontSize: "14px", color: "var(--landing-muted)", lineHeight: 1.5 }}>
                        Most LLM trading arenas collapse into noisy intraday decisions, weak risk
                        context, missing regime awareness, and no durable audit trail.
                    </p>
                </article>
                <article className="landing-mini-card" style={{ background: "var(--landing-surface)" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", marginBottom: "8px", color: "var(--landing-purple)" }}>System Fix</h3>
                    <p style={{ fontSize: "14px", color: "var(--landing-muted)", lineHeight: 1.5 }}>
                        This arena uses controlled ticks, OHLC-derived quant features, cross-sectional
                        ranks, portfolio analytics, append-only Redis logs, and deterministic replay.
                    </p>
                </article>
            </div>
        </div>
      </section>

      <section className="landing-section" style={{ padding: "64px 32px", background: "var(--landing-surface-low)", borderTop: "1px solid var(--landing-line)", borderBottom: "1px solid var(--landing-line)" }}>
        <div className="landing-section__inner arena-doc-split" style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div>
                <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "24px" }}>Market Scope & Rules</h2>
                <div style={{ padding: "16px", background: "var(--landing-surface)", border: "1px solid var(--landing-line)", boxShadow: "4px 4px 0 0 var(--landing-line)" }}>
                    <span style={{ display: "block", fontSize: "10px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", color: "var(--landing-muted)", marginBottom: "8px" }}>SCORING FORMULA</span>
                    <code className="arena-code-line" style={{ fontSize: "12px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", color: "var(--accent-red)" }}>score = totalReturn - 0.5 * maxDrawdown - 0.1 * turnoverCost</code>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
                {rules.map(([label, value]) => (
                    <div key={label} className="arena-doc-kv-row" style={{ padding: "16px 0", borderBottom: "1px solid var(--landing-line)" }}>
                        <span style={{ fontSize: "14px", fontWeight: 800, fontFamily: "var(--font-mono), monospace" }}>{label}</span>
                        <strong style={{ fontSize: "14px", fontWeight: 400, color: "var(--landing-muted)" }}>{value}</strong>
                    </div>
                ))}
            </div>
        </div>
      </section>

      <section className="landing-section" style={{ padding: "64px 32px" }}>
        <div className="landing-section__inner" style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "32px" }}>Tick Packet Before Execution</h2>
            <div className="arena-doc-card-grid">
            {featureGroups.map(([title, copy]) => (
                <article key={title} className="landing-mini-card" style={{ background: "var(--landing-surface)" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 800, fontFamily: "var(--font-mono), monospace", marginBottom: "8px" }}>{title}</h3>
                <p style={{ fontSize: "14px", color: "var(--landing-muted)", lineHeight: 1.5 }}>{copy}</p>
                </article>
            ))}
            </div>
        </div>
      </section>

      <section className="landing-section" style={{ padding: "64px 32px", background: "var(--landing-surface-container)", borderTop: "1px solid var(--landing-line)" }}>
        <div className="landing-section__inner arena-doc-split" style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <div>
                <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "16px" }}>Redis Storage Contract</h2>
                <p style={{ fontSize: "14px", color: "var(--landing-muted)", lineHeight: 1.5 }}>
                    The UI is read-only first. Engine writes are stored under explicit Redis keys so
                    model state, orders, trades, snapshots, and leaderboards remain inspectable.
                </p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            {redisContracts.map((key) => (
                <code key={key} style={{ padding: "8px 16px", background: "var(--landing-surface)", border: "1px solid var(--landing-line)", fontSize: "12px", fontWeight: 800, fontFamily: "var(--font-mono), monospace" }}>
                    {key}
                </code>
            ))}
            </div>
        </div>
      </section>
    </main>
  );
}
