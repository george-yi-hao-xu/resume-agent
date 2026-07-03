import type { ChatMessage } from "../../client/src/types";

export type GeneratePatchesRequest = {
  instruction: string;
  allowedCssCustomProperties?: string[];
  conversationHistory?: ChatMessage[];
  resumeStructure?: string;
};

export type LlmStatusResponse =
  | {
      ok: true;
      provider: string;
      model: string;
      message: string;
    }
  | {
      ok: false;
      provider: string;
      model: string;
      reason: "offline" | "model_missing" | "missing_config";
      message: string;
      availableModels?: string[];
    };

export type ModelMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
