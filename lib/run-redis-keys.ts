export function runConfigKey(runId: string) {
    return `run:${runId}:config`
}

export function runLeaderboardKey(runId: string) {
    return `run:${runId}:leaderboard:latest`
}

export function modelStateKey(runId: string, modelId: string) {
    return `run:${runId}:model:${modelId}:state`
}

export function modelTradesKey(runId: string, modelId: string) {
    return `run:${runId}:model:${modelId}:trades`
}

export function modelOrdersKey(runId: string, modelId: string) {
    return `run:${runId}:model:${modelId}:orders`
}

export function modelChatKey(runId: string, modelId: string) {
    return `run:${runId}:model:${modelId}:chat`
}

export function tickSnapshotKey(runId: string, tickId: string) {
    return `run:${runId}:tick:${tickId}:snapshot`
}

export function modelPfAnalyticsKey(runId: string, modelId: string) {
    return `run:${runId}:model:${modelId}:pf-analytics`
}
