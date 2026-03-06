import type { RedisClientType } from "redis";
import { ModelState, Trade, PortfolioAnalytics } from "@/types/global";
import { modelPfAnalyticsKey } from "@/lib/run-redis-keys";
import { logger } from "@/lib/logger";

/**
 * Compute rich portfolio analytics from live model state and closed trade history.
 * Result is intended to be saved to Redis and passed as LLM context on each tick.
 */
export function computePortfolioAnalytics(
    runId: string,
    state: ModelState,
    trades: Trade[]
): PortfolioAnalytics {
    const { modelId, cash, nav, positions, metrics } = state;

    // --- Allocation ---
    const cashPct = nav > 0 ? cash / nav : 1;
    const exposurePct = 1 - cashPct;
    const numOpenPositions = positions.length;

    // --- Concentration (HHI) ---
    // Sum of squared weight of each position in the invested portfolio
    const totalInvested = positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);
    let hhi = 0;
    if (totalInvested > 0) {
        hhi = positions.reduce((s, p) => {
            const w = (p.quantity * p.currentPrice) / totalInvested;
            return s + w * w;
        }, 0);
    }

    // --- Unrealized P&L ---
    const unrealizedPnL = positions.reduce((s, p) => s + p.pnl, 0);
    const unrealizedPnLPct = nav > 0 ? unrealizedPnL / nav : 0;

    // MAE / MFE averages (only positions that have these values)
    const maePosns = positions.filter((p) => p.mae !== undefined);
    const mfePosns = positions.filter((p) => p.mfe !== undefined);
    const avgMAE = maePosns.length > 0
        ? maePosns.reduce((s, p) => s + p.mae!, 0) / maePosns.length
        : 0;
    const avgMFE = mfePosns.length > 0
        ? mfePosns.reduce((s, p) => s + p.mfe!, 0) / mfePosns.length
        : 0;

    // Portfolio volatility proxy: nav-weighted avg |pnlPct| across positions
    const portfolioVolatilityProxy = totalInvested > 0
        ? positions.reduce((s, p) => {
            const w = (p.quantity * p.currentPrice) / totalInvested;
            return s + w * Math.abs(p.pnlPct);
        }, 0)
        : 0;

    // --- Realized P&L (from closed trades) ---
    const closedTrades = trades.filter((t) => t.pnl !== undefined);
    const realizedPnL = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

    const winners = closedTrades.filter((t) => (t.pnl ?? 0) > 0);
    const losers  = closedTrades.filter((t) => (t.pnl ?? 0) < 0);

    const winRate = closedTrades.length > 0 ? winners.length / closedTrades.length : 0;
    const avgWin  = winners.length > 0
        ? winners.reduce((s, t) => s + t.pnl!, 0) / winners.length
        : 0;
    const avgLoss = losers.length > 0
        ? losers.reduce((s, t) => s + t.pnl!, 0) / losers.length
        : 0;

    const grossProfit = winners.reduce((s, t) => s + t.pnl!, 0);
    const grossLoss   = Math.abs(losers.reduce((s, t) => s + t.pnl!, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : Infinity;

    return {
        modelId,
        runId,
        computedAt: new Date().toISOString(),
        cashPct,
        exposurePct,
        numOpenPositions,
        hhi,
        unrealizedPnL,
        unrealizedPnLPct,
        avgMAE,
        avgMFE,
        portfolioVolatilityProxy,
        realizedPnL,
        winRate,
        avgWin,
        avgLoss,
        profitFactor,
        totalReturn: metrics.totalReturn,
        maxDrawdown: metrics.maxDrawdown,
        drawdownDuration: metrics.drawdownDuration ?? 0,
        turnoverCost: metrics.turnoverCost,
        score: metrics.score,
    };
}

/**
 * Save computed portfolio analytics to Redis.
 * Key: run:{runId}:model:{modelId}:pf-analytics
 */
export async function savePortfolioAnalytics(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: RedisClientType<any, any, any>,
    analytics: PortfolioAnalytics
): Promise<void> {
    const key = modelPfAnalyticsKey(analytics.runId, analytics.modelId);
    await client.set(key, JSON.stringify(analytics));
    logger.debug("Saved portfolio analytics →", key);
}
