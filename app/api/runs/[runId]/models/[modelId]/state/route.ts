// GET /api/runs/[runId]/models/[modelId]/state
import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { modelStateKey } from "@/lib/run-redis-keys";
import { getModelIdReadCandidates, normalizeModelId } from "@/lib/model-id";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ runId: string; modelId: string }> }
) {
    const { runId, modelId: requestedModelId } = await params;
    const modelId = normalizeModelId(requestedModelId);
    const client = await getRedisClient();
    try {
        let raw: string | null = null;
        for (const candidate of getModelIdReadCandidates(modelId)) {
            raw = await client.get(modelStateKey(runId, candidate));
            if (raw !== null) break;
        }
        if (raw === null) {
            return NextResponse.json({ error: "Model state not found" }, { status: 404 });
        }
        return NextResponse.json({ ...JSON.parse(raw), modelId });
    } finally {
        await client.disconnect();
    }
}
