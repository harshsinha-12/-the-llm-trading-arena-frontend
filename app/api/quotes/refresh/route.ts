// POST /api/quotes/refresh
// Scans all Nifty 50 constituent OHLC keys, takes the last candle per stock,
// and saves quote:{mbCode} entries to Redis.
//
// Call this once after OHLC data is seeded, and then after each daily ingest.

import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { refreshAllQuotes } from "@/lib/get-quotes";
import { logger } from "@/lib/logger";

export async function POST() {
    const client = await getRedisClient();
    try {
        const result = await refreshAllQuotes(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            client as any
        );
        logger.info(`POST /api/quotes/refresh — refreshed=${result.refreshed} failed=${result.failed.length}`);
        return NextResponse.json({
            ok: true,
            refreshed: result.refreshed,
            failed: result.failed,
        });
    } finally {
        await client.disconnect();
    }
}

export async function GET() {
    return NextResponse.json({ error: "Use POST to refresh quotes." }, { status: 405 });
}
