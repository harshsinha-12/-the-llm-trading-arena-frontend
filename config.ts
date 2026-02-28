export const INDEX_MBCODE = "MBIDX70";
export const ACTIVE_RUN_ID = "season1";

// Ticker stocks shown on the home page
export const TICKER_STOCKS = [
    { mbCode: "MBEQU5710", symbol: "RELIANCE", name: "Reliance Industries" },
    { mbCode: "MBEQU5391", symbol: "HDFCBANK", name: "HDFC Bank" },
    { mbCode: "MBEQU2325", symbol: "TCS", name: "Tata Consultancy Services" },
] as const;

// Season 1 model definitions — used as fallback when run:season1:config is absent
export const SEASON1_MODELS = [
    { modelId: "mean-rev",  name: "Mean Rev",   color: "#e6e6fa", strategy: "Mean Reversion"   },
    { modelId: "trend-fol", name: "Trend Fol",  color: "#e6f7ff", strategy: "Trend Following"  },
    { modelId: "sentiment", name: "Sentiment",  color: "#fff0f6", strategy: "Sentiment/News"   },
    { modelId: "macro",     name: "Macro",      color: "#f6ffed", strategy: "Macro"            },
] as const;
