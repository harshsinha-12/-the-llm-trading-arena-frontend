import { GPT_5_5_MODEL_ID } from "@/lib/model-id";

export const INDEX_MBCODE = "MBIDX70";
export const ACTIVE_RUN_ID = "season1";

// Ticker stocks shown on the home page
export const TICKER_STOCKS = [
    { mbCode: "MBEQU5710", symbol: "RELIANCE", name: "Reliance Industries" },
    { mbCode: "MBEQU5391", symbol: "HDFCBANK", name: "HDFC Bank" },
    { mbCode: "MBEQU2325", symbol: "TCS", name: "Tata Consultancy Services" },
] as const;

// Season 1 model definitions — used as fallback when run:season1:config is absent.
// Each entry represents one LLM competitor. Add more models here as the arena scales.
export const SEASON1_MODELS = [
    { modelId: GPT_5_5_MODEL_ID, name: "GPT-5.5", color: "#e6e6fa", strategy: "Quantitative Trading" },
] as const;
