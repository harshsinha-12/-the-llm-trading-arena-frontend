// GET /api/runs/[runId]/leaderboard
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { runLeaderboardKey } from "@/lib/run-redis-keys";
import { normalizeModelId } from "@/lib/model-id";
import type { LeaderboardEntry } from "@/types/global";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string }> }
) {
    const { runId } = await params;
    const client = await getRedisClient();
    try {
        const raw = await client.get(runLeaderboardKey(runId));
        if (raw === null) {
            return NextResponse.json({ error: "Leaderboard not found" }, { status: 404 });
        }
        return NextResponse.json((JSON.parse(raw) as LeaderboardEntry[]).map((entry) => {
            const modelId = normalizeModelId(entry.modelId);
            return {
                ...entry,
                modelId,
                name: modelId === "gpt-5-5" ? "GPT-5.5" : entry.name,
            };
        }));
    } finally {
        await client.disconnect();
    }
}
