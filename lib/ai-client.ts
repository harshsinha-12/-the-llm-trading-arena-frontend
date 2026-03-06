import OpenAI, { AzureOpenAI } from "openai";
import { QAModel, GEMINI_3_PRO, GPT_5_2, GPT_4O_TRANSCRIBE } from "@/lib/models";
import { logger } from "@/lib/logger";

export const getAIClient = (model: QAModel, apiVersion: string) => {
    if (model === GEMINI_3_PRO) {
        const client = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY_MB_AI,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        });
        logger.debug("Using Gemini client for model:", model);
        return client;
    } else if (model === GPT_5_2 || model === GPT_4O_TRANSCRIBE) {
        const client = new AzureOpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY_SWEDEN,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT_SWEDEN,
            deployment: model,
            apiVersion,
        });
        logger.debug("Using Azure OpenAI Sweden client for model:", model);
        return client;
    } else {
        // Grok-4 Fast Reasoning, Mistral Large 3, GPT-5-mini, GPT-5-nano
        const client = new AzureOpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT,
            deployment: model,
            apiVersion,
        });
        logger.debug("Using Azure OpenAI client for model:", model);
        return client;
    }
};
