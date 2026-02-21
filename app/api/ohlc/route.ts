// GET /api/ohlc?duration=1Y
// GET /api/ohlc?mbCode=RELIANCE&duration=1Y
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { ohlcKey } from "@/lib/redis-keys";
import { getConstituentMbCodes } from "@/lib/get-constituents";
import { GraphDuration } from "@/types/global";

const VALID_DURATIONS: GraphDuration[] = ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'];

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const mbCode = searchParams.get("mbCode");
    const duration = searchParams.get("duration") as GraphDuration | null;

    if (!duration || !VALID_DURATIONS.includes(duration)) {
        return NextResponse.json({ error: `duration must be one of: ${VALID_DURATIONS.join(", ")}` }, { status: 400 });
    }

    const client = await getRedisClient();
    try {
        if (mbCode) {
            const data = await client.get(ohlcKey(mbCode, duration));
            if (data === null) {
                return NextResponse.json({ error: "Not found" }, { status: 404 });
            }
            return NextResponse.json(JSON.parse(data));
        }

        const mbCodes = await getConstituentMbCodes(client);
        if (mbCodes.length === 0) {
            return NextResponse.json({ error: "No constituents found" }, { status: 404 });
        }

        const results = await Promise.all(
            mbCodes.map(async (code) => {
                const raw = await client.get(ohlcKey(code, duration));
                return [code, raw ? JSON.parse(raw) : null] as const;
            })
        );

        return NextResponse.json(Object.fromEntries(results));
    } finally {
        await client.disconnect();
    }
}
