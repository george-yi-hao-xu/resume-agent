import type { ChatMessage } from "../../client/src/types";

export type GeneratePatchesRequest = {
  instruction: string;
  allowedCssCustomProperties?: string[];
  conversationHistory?: ChatMessage[];
  resumeSummary?: string;
  resumeDom?: string;
  resumeStructure?: string;
};

export type GenerateWildDomRequest = {
  instruction: string;
  conversationHistory?: ChatMessage[];
  resumeDom: string;
};

export type WildDomProviderResult = {
  html: string;
  provider: string;
  model?: string;
  note?: string;
  usage?: {
    promptEvalCount?: number;
    evalCount?: number;
    totalDuration?: number;
    loadDuration?: number;
    promptEvalDuration?: number;
    evalDuration?: number;
  };
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
