// GET /api/runs/[runId]/config
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { runConfigKey } from "@/lib/run-redis-keys";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const { runId } = await params;
    const client = await getRedisClient();
    try {
        const raw = await client.get(runConfigKey(runId));
        if (raw === null) {
            return NextResponse.json({ error: "Run config not found" }, { status: 404 });
        }
        return NextResponse.json(JSON.parse(raw));
    } finally {
        await client.disconnect();
    }
}
