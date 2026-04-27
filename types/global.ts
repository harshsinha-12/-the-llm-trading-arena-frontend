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
        maxPositionSizePct: number   
        brokerageBps: number         
        slippageBps: number
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
    totalReturn: number     
    maxDrawdown: number 
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
    confidence: number;
};

export type PortfolioAnalytics = {
    modelId: string
    runId: string
    computedAt: string
    cashPct: number           
    exposurePct: number       
    numOpenPositions: number
    hhi: number               
    unrealizedPnL: number
    unrealizedPnLPct: number
    avgMAE: number            
    avgMFE: number            
    portfolioVolatilityProxy: number  
    realizedPnL: number
    winRate: number           
    avgWin: number            
    avgLoss: number           
    profitFactor: number      
    totalReturn: number
    maxDrawdown: number
    drawdownDuration: number
    turnoverCost: number
    score: number
}
