// GET /api/runs/[runId]/models/[modelId]/trades
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { modelTradesKey } from "@/lib/run-redis-keys";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string; modelId: string }> }
) {
    const { runId, modelId } = await params;
    const client = await getRedisClient();
    try {
        const raw = await client.get(modelTradesKey(runId, modelId));
        if (raw === null) {
            return NextResponse.json({ error: "Trades not found" }, { status: 404 });
        }
        return NextResponse.json(JSON.parse(raw));
    } finally {
        await client.disconnect();
    }
}
