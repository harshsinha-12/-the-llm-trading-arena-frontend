// POST /api/runs/[runId]/models/[modelId]/decide
// Triggers the GPT-5.2 trading agent for a specific model and saves the decision.
//
// Body (JSON, all optional):
//   strategy  string   — model's strategy description (looked up from run config if omitted)
//   dryRun    boolean  — if true, skips writing analytics + orders to Redis (default: false)
//
// Response:
//   200  TradeDecision  { orders, risk_controls, rationale, confidence }
//   404  if run config or model state is missing
//   405  if method is not POST

import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";
import { runConfigKey, modelOrdersKey } from "@/lib/run-redis-keys";
import { runGPT52TradeDecision } from "@/lib/chatbot-gpt52";
import { RunConfig } from "@/types/global";
import { SEASON1_MODELS } from "@/config";
import { logger } from "@/lib/logger";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ runId: string; modelId: string }> }
) {
    const { runId, modelId } = await params;

    let strategy = "General";
    let dryRun = false;

    // Parse optional body
    try {
        const body = await req.json();
        if (typeof body.strategy === "string") strategy = body.strategy;
        if (typeof body.dryRun === "boolean") dryRun = body.dryRun;
    } catch {
        // Empty or non-JSON body is fine — all fields are optional
    }

    // Look up strategy from run config, falling back to SEASON1_MODELS if Redis has no config yet
    if (strategy === "General") {
        const client = await getRedisClient();
        try {
            const cfgRaw = await client.get(runConfigKey(runId));
            if (cfgRaw) {
                const config: RunConfig = JSON.parse(cfgRaw);
                const modelConfig = config.models.find((m) => m.modelId === modelId);
                if (modelConfig?.strategy) strategy = modelConfig.strategy;
            } else {
                // Redis config not seeded yet — use local fallback
                const fallback = SEASON1_MODELS.find((m) => m.modelId === modelId);
                if (fallback?.strategy) strategy = fallback.strategy;
                logger.warn(`run:${runId}:config not in Redis — using fallback strategy: "${strategy}"`);
            }
        } finally {
            await client.disconnect();
        }
    }

    logger.info(`/decide triggered — runId=${runId} modelId=${modelId} strategy="${strategy}" dryRun=${dryRun}`);

    const decision = await runGPT52TradeDecision(runId, modelId, strategy, { dryRun });

    // Persist the decision to Redis unless dry run
    if (!dryRun && decision.orders.length > 0) {
        const client = await getRedisClient();
        try {
            const key = modelOrdersKey(runId, modelId);
            const entry = {
                decidedAt: new Date().toISOString(),
                modelId,
                ...decision,
            };
            // Append to a Redis list so every decision is auditable
            await client.rPush(key, JSON.stringify(entry));
            logger.info(`Decision saved → ${key} (${decision.orders.length} orders)`);
        } finally {
            await client.disconnect();
        }
    }

    return NextResponse.json({
        runId,
        modelId,
        dryRun,
        decidedAt: new Date().toISOString(),
        ...decision,
    });
}

export async function GET() {
    return NextResponse.json({ error: "Use POST to trigger a trade decision." }, { status: 405 });
}
