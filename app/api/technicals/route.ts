// GET /api/technicals
// GET /api/technicals?mbCode=RELIANCE
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { technicalsKey } from "@/lib/redis-keys";
import { getConstituentMbCodes } from "@/lib/get-constituents";

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const mbCode = searchParams.get("mbCode");
    const client = await getRedisClient();
    try {
        if (mbCode) {
            const data = await client.get(technicalsKey(mbCode));
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
                const raw = await client.get(technicalsKey(code));
                return [code, raw ? JSON.parse(raw) : null] as const;
            })
        );
        return NextResponse.json(Object.fromEntries(results));
    } finally {
        await client.disconnect();
    }
}
