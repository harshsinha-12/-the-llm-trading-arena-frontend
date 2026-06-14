export const GPT_5_5 = "gpt-5.5"
export const GPT_5_4 = "gpt-5.4"
export const MISTRAL_LARGE_3 = "Mistral-Large-3"
export const GEMINI_3_1_PRO = "gemini-3.1-pro-preview"
export const GROK_4_FAST_REASONING = "grok-4-fast-reasoning"
export const GPT_5_MINI = "gpt-5-mini"
export const GPT_5_NANO = "gpt-5-nano"
export const GPT_4O_TRANSCRIBE = "gpt-4o-transcribe"

export type QAModel =
    | typeof GPT_5_4
    | typeof GPT_5_5
    | typeof MISTRAL_LARGE_3
    | typeof GEMINI_3_1_PRO
    | typeof GROK_4_FAST_REASONING
    | typeof GPT_5_MINI
    | typeof GPT_5_NANO

export const API_VERSIONS: Record<QAModel, string> = {
    [GEMINI_3_1_PRO]: "v1beta",
    [MISTRAL_LARGE_3]: "2024-05-01-preview",
    [GROK_4_FAST_REASONING]: "2024-05-01-preview",
    [GPT_5_5]: "2025-04-01-preview",
    [GPT_5_MINI]: "2025-01-01-preview",
    [GPT_5_NANO]: "2025-01-01-preview",
    [GPT_5_4]: "2025-04-01-preview",
};
