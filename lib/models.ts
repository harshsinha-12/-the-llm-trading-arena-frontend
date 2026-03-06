export const GPT_5_2 = "gpt-5.2" as const;
export const MISTRAL_LARGE_3 = "Mistral-Large-3" as const;
export const GEMINI_3_PRO = "gemini-3-pro-preview" as const;
export const TEXT_EMBEDDING_3_SMALL = "text-embedding-3-small" as const;
export const COHERE_RERANK_3_5 = "cohere-rerank-3.5" as const;
export const GROK_4_FAST_REASONING = "grok-4-fast-reasoning" as const;
export const GPT_5_MINI = "gpt-5-mini" as const;
export const GPT_5_NANO = "gpt-5-nano" as const;
export const GPT_4O_TRANSCRIBE = "gpt-4o-transcribe" as const;

export type QAModel =
    | typeof GPT_5_2
    | typeof MISTRAL_LARGE_3
    | typeof GEMINI_3_PRO
    | typeof TEXT_EMBEDDING_3_SMALL
    | typeof COHERE_RERANK_3_5
    | typeof GROK_4_FAST_REASONING
    | typeof GPT_5_MINI
    | typeof GPT_5_NANO
    | typeof GPT_4O_TRANSCRIBE;

export const API_VERSIONS: Record<QAModel, string> = {
    [TEXT_EMBEDDING_3_SMALL]: "2024-04-01-preview",
    [GEMINI_3_PRO]: "v1beta",
    [MISTRAL_LARGE_3]: "2024-05-01-preview",
    [GROK_4_FAST_REASONING]: "2024-05-01-preview",
    [GPT_5_2]: "2025-04-01-preview",
    [GPT_5_MINI]: "2025-01-01-preview",
    [GPT_5_NANO]: "2025-01-01-preview",
    [GPT_4O_TRANSCRIBE]: "2025-03-01-preview",
    [COHERE_RERANK_3_5]: "2024-05-01-preview",
};
