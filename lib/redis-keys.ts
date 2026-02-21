import { GraphDuration } from "../types/global";

export const REDIS_KEY_PREFIX = {
    OHLC: "ohlc",
    TECHNICALS: "technicals",
    NEWS: "news",
    CONSTITUENTS: "constituents",
} as const;

export function ohlcKey(mbCode: string, duration: GraphDuration): string {
    return `${REDIS_KEY_PREFIX.OHLC}:${mbCode}:${duration}`;
}

export function technicalsKey(mbCode: string): string {
    return `${REDIS_KEY_PREFIX.TECHNICALS}:${mbCode}`;
}

export function newsKey(mbCode: string): string {
    return `${REDIS_KEY_PREFIX.NEWS}:${mbCode}`;
}

export function constituentsKey(indexMBCode: string): string {
    return `${REDIS_KEY_PREFIX.CONSTITUENTS}:${indexMBCode}`;
}
