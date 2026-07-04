import { Injectable } from "@nestjs/common";
import { OPENAI_CHAT_COMPLETIONS_URL } from "../../client/src/constants";
import { CHAT_ROLE, LlmProvider, type LlmUsage } from "../../client/src/types";
import type { LlmConfig } from "./llm.config";
import type { LlmStatusResponse, ModelMessage } from "./llm.types";

export type RawGenerationResult = {
  usage: LlmUsage;
  rawContent: string;
};

type RuntimeConfig = ReturnType<LlmConfig["getRuntimeConfig"]>;

@Injectable()
export class LlmProviderService {
  async callRaw(config: RuntimeConfig, messages: ModelMessage[]): Promise<RawGenerationResult> {
    return config.provider === LlmProvider.OpenAI
      ? this.callOpenAIRaw(config.model, config.openAiApiKey, config.temperature, messages)
      : this.callOllamaRaw(config.model, config.ollamaChatUrl, config.temperature, messages);
  }

  async getStatus(config: RuntimeConfig): Promise<LlmStatusResponse> {
    if (config.provider === LlmProvider.OpenAI) {
      if (!config.openAiApiKey) {
        return {
          ok: false,
          provider: config.provider,
          model: config.model,
          reason: "missing_config",
          message: "OpenAI API key is required on the server."
        };
      }

      return {
        ok: true,
        provider: config.provider,
        model: config.model,
        message: `${config.model} is configured.`
      };
    }

    return this.checkOllamaHealth(config.ollamaChatUrl, config.model);
  }

  async warmupOllama(config: RuntimeConfig): Promise<boolean> {
    if (config.provider !== LlmProvider.Ollama) {
      return true;
    }

    try {
      const response = await fetch(getOllamaChatUrl(config.ollamaChatUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          keep_alive: "10m",
          messages: [
            {
              role: CHAT_ROLE.USER,
              content: "ping"
            }
          ],
          options: {
            num_predict: 1,
            temperature: 0
          }
        })
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async callOpenAIRaw(
    model: string,
    apiKey: string,
    temperature: number,
    messages: ModelMessage[]
  ): Promise<RawGenerationResult> {
    if (!apiKey) {
      throw new Error("OpenAI API key is required on the server.");
    }

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    return {
      rawContent: content,
      usage: {
        promptEvalCount: data.usage?.prompt_tokens,
        evalCount: data.usage?.completion_tokens
      }
    };
  }

  private async callOllamaRaw(
    model: string,
    backEndUrl: string,
    temperature: number,
    messages: ModelMessage[]
  ): Promise<RawGenerationResult> {
    const chatUrl = getOllamaChatUrl(backEndUrl);
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: {
          temperature
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} from ${chatUrl}.`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_duration?: number;
      eval_duration?: number;
    };
    const content = data.message?.content;
    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return {
      rawContent: content,
      usage: parseOllamaUsage(data)
    };
  }

  private async checkOllamaHealth(backEndUrl: string, model: string): Promise<LlmStatusResponse> {
    try {
      const response = await fetch(getOllamaTagsUrl(backEndUrl), {
        method: "GET"
      });

      if (!response.ok) {
        return {
          ok: false,
          provider: LlmProvider.Ollama,
          model,
          reason: "offline",
          message: `Ollama returned ${response.status}.`
        };
      }

      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      const models = data.models ?? [];
      const availableModels = models.map((item) => item.name || item.model).filter((item): item is string => !!item);
      const hasModel = models.some((item) => item.name === model || item.model === model);

      if (!hasModel) {
        return {
          ok: false,
          provider: LlmProvider.Ollama,
          model,
          reason: "model_missing",
          message: `Model ${model} was not found.`,
          availableModels
        };
      }

      return {
        ok: true,
        provider: LlmProvider.Ollama,
        model,
        message: `${model} is available.`
      };
    } catch {
      return {
        ok: false,
        provider: LlmProvider.Ollama,
        model,
        reason: "offline",
        message: "Ollama is not reachable."
      };
    }
  }
}

function parseOllamaUsage(data: {
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}): LlmUsage {
  return {
    promptEvalCount: data.prompt_eval_count,
    evalCount: data.eval_count,
    totalDuration: data.total_duration,
    loadDuration: data.load_duration,
    promptEvalDuration: data.prompt_eval_duration,
    evalDuration: data.eval_duration
  };
}

export function getOllamaTagsUrl(backEndUrl: string): string {
  const url = new URL(backEndUrl);
  url.pathname = "/api/tags";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function getOllamaChatUrl(backEndUrl: string): string {
  const url = new URL(backEndUrl);
  if (url.pathname === "/" || url.pathname === "" || url.pathname === "/api/tags") {
    url.pathname = "/api/chat";
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}
