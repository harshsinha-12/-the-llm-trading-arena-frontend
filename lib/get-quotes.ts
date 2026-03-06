/**
 * getQuotes — derive current price quotes from stored OHLC data.
 *
 * For each Nifty 50 mbCode:
 *   1. Try OHLC duration keys in priority order (broadest first so we always find data)
 *   2. Take the LAST element of the array (most recent candle)
 *   3. Save as quote:{mbCode} in Redis
 *
 * The chatbot and trade-executor both read quote:{mbCode} for current prices.
 */

import type { RedisClientType } from "redis";
import { ohlcKey, quoteKey, constituentsKey } from "@/lib/redis-keys";
import { GraphDuration } from "@/types/global";
import { logger } from "@/lib/logger";

const NIFTY_50_INDEX_CODE = "MBIDX70";

// Try longest-history first so we get the most complete dataset.
// The last element of any of these will be the most recent available candle.
const DURATION_PRIORITY: GraphDuration[] = [
    "10Y", "5Y", "3Y", "1Y", "6M", "3M", "1M", "YTD", "1W", "1D",
];

export type Quote = {
    mbCode: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    datetime: string;   // ISO date of the candle
    updatedAt: string;  // when we computed this quote
};

interface RawCandle {
    datetime: string;
    close: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
}

// ─── Internal: find the latest candle for one mbCode ─────────────────────────

async function latestCandle(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: RedisClientType<any, any, any>,
    mbCode: string
): Promise<RawCandle | null> {
    for (const duration of DURATION_PRIORITY) {
        const raw = await client.get(ohlcKey(mbCode, duration));
        if (!raw) continue;
        try {
            const data = JSON.parse(raw) as RawCandle[];
            if (!Array.isArray(data) || data.length === 0) continue;
            const last = data[data.length - 1];
            if (last?.close) return last;
        } catch {
            continue;
        }
    }
    return null;
}

// ─── Public: get a single quote (reads cache, falls back to OHLC) ─────────────

export async function getQuote(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: RedisClientType<any, any, any>,
    mbCode: string
): Promise<Quote | null> {
    // Try cached quote first
    const cached = await client.get(quoteKey(mbCode));
    if (cached) {
        try { return JSON.parse(cached) as Quote; } catch { /* fall through */ }
    }
    // Compute on-the-fly from OHLC
    const candle = await latestCandle(client, mbCode);
    if (!candle) return null;
    return {
        mbCode,
        close:     candle.close,
        open:      candle.open,
        high:      candle.high,
        low:       candle.low,
        volume:    candle.volume,
        datetime:  typeof candle.datetime === "string"
            ? candle.datetime
            : new Date(candle.datetime).toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

// ─── Public: refresh quotes for all Nifty 50 constituents ────────────────────

export async function refreshAllQuotes(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: RedisClientType<any, any, any>
): Promise<{ refreshed: number; failed: string[] }> {
    const constituentRaw = await client.get(constituentsKey(NIFTY_50_INDEX_CODE));
    if (!constituentRaw) {
        logger.warn("refreshAllQuotes: No constituents found at", `constituents:${NIFTY_50_INDEX_CODE}`);
        return { refreshed: 0, failed: [] };
    }

    const mbCodes = JSON.parse(constituentRaw) as string[];
    const failed: string[] = [];
    let refreshed = 0;

    await Promise.all(
        mbCodes.map(async (mbCode) => {
            const candle = await latestCandle(client, mbCode);
            if (!candle) {
                failed.push(mbCode);
                return;
            }
            const quote: Quote = {
                mbCode,
                close:     candle.close,
                open:      candle.open,
                high:      candle.high,
                low:       candle.low,
                volume:    candle.volume,
                datetime:  typeof candle.datetime === "string"
                    ? candle.datetime
                    : new Date(candle.datetime).toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await client.set(quoteKey(mbCode), JSON.stringify(quote));
            refreshed++;
        })
    );

    logger.info(`refreshAllQuotes: ${refreshed}/${mbCodes.length} refreshed, ${failed.length} failed.`);
    if (failed.length) logger.warn("refreshAllQuotes: No OHLC data for:", failed.join(", "));
    return { refreshed, failed };
}
