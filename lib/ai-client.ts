import { logger } from "@/lib/logger";
import { GEMINI_3_1_PRO, QAModel } from "@/lib/models";
import OpenAI from "openai";

export const getAIClient = (model: QAModel) => {
    if (model === GEMINI_3_1_PRO) {
        const client = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY_MB_AI,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        });
        logger.debug("Using Gemini 3.1 Pro client for model:", model);
        return client;
    }

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    logger.debug("Using OpenAI client for model:", model);
    return client;
};
