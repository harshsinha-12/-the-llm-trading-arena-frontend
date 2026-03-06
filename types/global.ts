export type MBCode = string
export type CmotsCode = number

export type GraphDuration = '1D' | '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '3Y' | '5Y' | '10Y'

export type OHLC = {
    datetime: Date
    open: number
    high: number
    low: number
    close: number
}

export type StockQuote = {
    datetime: Date
    mbCode: string
    symbol: string
    name: string
    price: number
    open?: number
    high?: number
    low?: number
    changesPercentage: number
    change: number
    volume: number
}

export type CmotsStockQuote = {
    sc_code: string
    co_code: number
    CO_NAME: string
    price: number
    Open: number
    High: number
    Low: number
    Volume: number
    Price_diff: number
    change: number
    Tr_Date: string
}

export type CmotsIndexStockOhlc = {
    co_code: number
    lname: string
    open: number
    high: number
    low: number
    close: number
    Volume: number
    TradeDate: string
}

export interface OHLCDataPoint {
    datetime: string
    close: number
    volume: number
}

// --- Run / Model types ---

export type ModelConfig = {
    modelId: string
    name: string
    llm: string
    strategy: string
}

export type RunConfig = {
    runId: string
    season: string
    status: 'active' | 'completed' | 'paused'
    startDate: string
    endDate?: string
    universe: string[]
    models: ModelConfig[]
    rules: {
        startingCapital: number
        maxPositions: number
        maxPositionSizePct: number   // e.g., 0.2 for 20%
        brokerageBps: number         // e.g., 10
        slippageBps: number          // e.g., 5
    }
}

export type Position = {
    symbol: string
    mbCode: string
    quantity: number
    avgPrice: number
    currentPrice: number
    pnl: number
    pnlPct: number
    mae?: number
    mfe?: number
}

export type ModelMetrics = {
    totalReturn: number     // decimal e.g. 0.062 = 6.2%
    maxDrawdown: number     // negative decimal e.g. -0.021
    turnoverCost: number
    score: number
    hhi?: number
    drawdownDuration?: number
    numTrades?: number
}

export type ModelState = {
    modelId: string
    cash: number
    nav: number
    positions: Position[]
    metrics: ModelMetrics
    lastUpdated: string
}

export type Trade = {
    tradeId: string
    date: string
    symbol: string
    mbCode: string
    side: 'BUY' | 'SELL'
    quantity: number
    price: number
    value: number
    pnl?: number
    reason?: string
}

export type LeaderboardEntry = {
    rank: number
    modelId: string
    name: string
    score: number
    totalReturn: number
    maxDrawdown: number
    turnoverCost: number
    nav: number
    numTrades?: number
}

// ─── LLM trade decision types ─────────────────────────────────────────────────

export type Order = {
    symbol: string;
    action: "BUY" | "SELL" | "HOLD";
    quantity: number;
    rationale: string;
};

export type RiskControls = {
    maxNewPositions?: number;
    stopLossSymbols?: string[];
    profitTargetSymbols?: string[];
};

export type TradeDecision = {
    orders: Order[];
    risk_controls: RiskControls;
    rationale: string;
    confidence: number; // 0.0 – 1.0
};

// Rich portfolio analytics — computed from ModelState + Trade history, saved to Redis
// for use as LLM context on each tick.
export type PortfolioAnalytics = {
    modelId: string
    runId: string
    computedAt: string

    // Allocation
    cashPct: number           // cash / nav
    exposurePct: number       // invested / nav
    numOpenPositions: number

    // Concentration
    hhi: number               // Herfindahl-Hirschman Index (0=diversified, 1=concentrated)

    // Unrealized (live positions)
    unrealizedPnL: number
    unrealizedPnLPct: number
    avgMAE: number            // avg max adverse excursion across positions (negative %)
    avgMFE: number            // avg max favorable excursion across positions (positive %)
    portfolioVolatilityProxy: number  // weighted avg |pnlPct| across positions

    // Realized (closed trades)
    realizedPnL: number
    winRate: number           // % of closed trades with pnl > 0
    avgWin: number            // mean pnl of winning trades
    avgLoss: number           // mean pnl of losing trades (negative value)
    profitFactor: number      // gross profit / abs(gross loss), Infinity if no losses

    // Pass-through from ModelMetrics
    totalReturn: number
    maxDrawdown: number
    drawdownDuration: number
    turnoverCost: number
    score: number
}
