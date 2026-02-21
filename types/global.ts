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
