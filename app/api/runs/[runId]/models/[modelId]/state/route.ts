// GET /api/runs/[runId]/models/[modelId]/state
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { modelStateKey } from "@/lib/run-redis-keys";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string; modelId: string }> }
) {
    const { runId, modelId } = await params;
    const client = await getRedisClient();
    try {
        const raw = await client.get(modelStateKey(runId, modelId));
        if (raw === null) {
            return NextResponse.json({ error: "Model state not found" }, { status: 404 });
        }
        return NextResponse.json(JSON.parse(raw));
    } finally {
        await client.disconnect();
    }
}
