import type { ModelConfig, RunConfig } from "@/types/global";

export const GPT_5_5_MODEL_ID = "gpt-5-5";
export const LEGACY_GPT_5_2_MODEL_ID = "gpt-5-2";

export function normalizeModelId(modelId: string): string {
    return modelId === LEGACY_GPT_5_2_MODEL_ID ? GPT_5_5_MODEL_ID : modelId;
}

export function getModelIdReadCandidates(modelId: string): string[] {
    const normalized = normalizeModelId(modelId);
    return normalized === GPT_5_5_MODEL_ID
        ? [GPT_5_5_MODEL_ID, LEGACY_GPT_5_2_MODEL_ID]
        : [normalized];
}

export function normalizeModelConfig(model: ModelConfig): ModelConfig {
    const modelId = normalizeModelId(model.modelId);
    if (modelId !== GPT_5_5_MODEL_ID) return { ...model, modelId };

    return {
        ...model,
        modelId,
        name: "GPT-5.5",
        llm: model.llm === "gpt-5.2" || model.llm === "" ? "gpt-5.5" : model.llm,
    };
}

export function normalizeRunConfig(config: RunConfig): RunConfig {
    const modelsById = new Map<string, ModelConfig>();
    for (const model of config.models) {
        const normalized = normalizeModelConfig(model);
        modelsById.set(normalized.modelId, normalized);
    }

    return {
        ...config,
        models: Array.from(modelsById.values()),
    };
}
