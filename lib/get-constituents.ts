import { constituentsKey } from "./redis-keys";
import { INDEX_MBCODE } from "@/config";

interface RedisGetter {
    get(key: string): Promise<string | null>;
}

export async function getConstituentMbCodes(client: RedisGetter): Promise<string[]> {
    const raw = await client.get(constituentsKey(INDEX_MBCODE));
    if (raw === null) return [];
    return JSON.parse(raw) as string[];
}
