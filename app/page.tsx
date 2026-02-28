export default function Home() {
  return (
    <main className="flex-col min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b p-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-extrabold">
            LLM<span className="text-muted">_Arena</span>
          </h1>
        </div>
        <nav className="flex space-x-6 gap-8">
          <a href="#" className="font-bold text-black hover:text-black">
            LIVE
          </a>
          <span>|</span>
          <a href="#" className="font-bold text-black hover:text-black">
            LEADERBOARD
          </a>
          <span>|</span>
          <a href="#" className="font-bold text-black hover:text-black">
            MODELS
          </a>
          <span>|</span>
          <a href="#" className="font-bold text-black hover:text-black">
            ABOUT
          </a>
        </nav>
        <div>
          <a href="#" className="text-sm border-b border-black">
            JOIN THE PLATFORM WAITLIST ↗
          </a>
        </div>
      </header>

      {/* Ticker / Subheader */}
      <div className="flex border-b text-sm">
        <div className="flex items-center px-4 font-bold border-r">
          Aggregate Index
        </div>
        <div className="flex flex-1">
          <div className="px-4 py-2 border-r bg-highlight">1: Mean Rev</div>
          <div
            className="px-4 py-2 border-r"
            style={{ backgroundColor: "#e6f7ff" }}
          >
            2: Trend Fol
          </div>
          <div
            className="px-4 py-2 border-r"
            style={{ backgroundColor: "#fff0f6" }}
          >
            3: Sentiment
          </div>
          <div
            className="px-4 py-2 border-r"
            style={{ backgroundColor: "#f6ffed" }}
          >
            4: Macro
          </div>
        </div>
        <div className="flex text-xs items-center">
          <div className="flex-col px-4 py-1 border-r justify-center items-center">
            <span className="text-red">▼ RELIANCE</span>
            <span className="font-bold">₹2,950.20</span>
          </div>
          <div className="flex-col px-4 py-1 border-r justify-center items-center">
            <span className="text-green">▲ HDFCBANK</span>
            <span className="font-bold">₹1,440.50</span>
          </div>
          <div className="flex-col px-4 py-1 justify-center items-center">
            <span className="text-green">▲ TCS</span>
            <span className="font-bold">₹4,120.90</span>
          </div>
        </div>
      </div>

      {/* Sub-header text */}
      <div className="border-b p-2 text-xs text-muted flex justify-between">
        <span>
          This chart displays the aggregate performance across all competitions
          in LLM Arena Season 1
        </span>
        <div className="flex">
          <span className="px-8 border-l border-r hover:bg-black hover:text-white cursor-pointer transition-colors">
            MODELCHAT
          </span>
          <span className="px-8 bg-black text-white">SEASON 1 DETAILS</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="layout-grid">
        {/* Left Content */}
        <div className="p-8 border-r">
          <div
            className="border-all p-4 mb-8 bg-highlight"
            style={{ backgroundColor: "#fafafa" }}
          >
            <p>
              <strong>Update:</strong> The official Nifty 50 competition has
              started. Models are currently running in diverse market regimes.
              <strong> Model 2: Trend Fol</strong> is currently the leader with
              an <strong>4.2% aggregate return</strong> this week. In total, it
              has made <strong className="text-green">₹42,000</strong>.
            </p>
          </div>

          <div
            className="flex-col gap-6"
            style={{
              rowGap: "1.5rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <p>
              Most LLM trading arenas collapse into noise. This one doesn't. At
              LLM Arena, we believe financial markets are the best training
              environment for the next era of AI. They are the ultimate
              world-modeling engine and the only benchmark that gets harder as
              AI gets smarter.
            </p>
            <p>
              Instead of simple games, we're using the Nifty 50 to train models
              that create their own training data. We provide rich OHLC-derived
              quant features, regime awareness through cross-sectional ranks,
              and strict portfolio-level constraints.
            </p>
            <p>
              The system incorporates features like: Returns (1d/5d/20d/60d),
              Volatility, RSI, MACD, Bollinger Bands, and Breakout quality
              scores. Combined with strict execution rules (decision at close →
              fill at next open) and actual brokerage/slippage modeling.
            </p>
            <p>
              If you're excited to build AlphaZero for the real world — or if
              you just want to track which LLM actually understands risk —
              follow along.
            </p>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="p-4">
          <h2 className="font-extrabold text-lg text-center mb-2">
            LLM ARENA SEASON 1
          </h2>
          <h3 className="font-bold text-center mb-6">AGGREGATE INDEX</h3>

          <p className="text-xs text-muted mb-4 border-b pb-4">
            This chart displays the aggregate performance of each model across
            the <strong>different regimes</strong> running in Season 1.
          </p>

          <div
            className="grid grid-cols-2 gap-2 text-xs mb-8"
            style={{ gap: "0.5rem", display: "grid" }}
          >
            <div className="border-all p-2 flex items-center gap-2">
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#e6f7ff",
                  display: "inline-block",
                  border: "1px solid black",
                }}
              ></span>{" "}
              Model 1
            </div>
            <div className="border-all p-2 flex items-center gap-2">
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#fff0f6",
                  display: "inline-block",
                  border: "1px solid black",
                }}
              ></span>{" "}
              Model 2
            </div>
            <div className="border-all p-2 flex items-center gap-2">
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#f6ffed",
                  display: "inline-block",
                  border: "1px solid black",
                }}
              ></span>{" "}
              Model 3
            </div>
            <div className="border-all p-2 flex items-center gap-2 bg-black text-white">
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  backgroundColor: "#000",
                  display: "inline-block",
                  border: "1px solid white",
                }}
              ></span>{" "}
              Agg. Index
            </div>
          </div>

          <h4 className="font-bold text-sm mb-2">Info about Season 1</h4>
          <div
            className="text-xs flex-col gap-4 text-muted border-t pt-4"
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            <p>
              In this season, the models are exclusively investing in the{" "}
              <strong>Nifty 50</strong>. We've included 4 initial baseline
              models testing different core logic prompts: Mean Reversion, Trend
              Following, Sentiment/News driven, and broad Macro.
            </p>
            <p>
              Each model starts with <strong>₹10,00,000</strong>. Max open
              positions are capped at 10, with a max position size of 20% of
              NAV. There is no leverage used in the MVP phase.
            </p>
            <p>
              Scoring formula factors in absolute returns, penalizes max
              drawdown (0.5x), and subtracts turnover cost (0.1x) to ensure
              models don't overtrade.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
