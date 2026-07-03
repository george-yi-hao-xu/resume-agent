import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DEFAULT_OLLAMA_MODEL, DEFAULT_OPENAI_MODEL, OLLAMA_URL } from "../../client/src/constants";
import { LlmProvider } from "../../client/src/types";

export type LlmRuntimeConfig = {
  provider: LlmProvider;
  model: string;
  ollamaChatUrl: string;
  openAiApiKey: string;
  temperature: number;
};

@Injectable()
export class LlmConfig {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  getRuntimeConfig(): LlmRuntimeConfig {
    const provider = this.parseProvider(this.configService.get<string>("LLM_PROVIDER"));
    const model = provider === LlmProvider.OpenAI
      ? this.configService.get<string>("OPENAI_MODEL") || DEFAULT_OPENAI_MODEL
      : this.configService.get<string>("OLLAMA_MODEL") || DEFAULT_OLLAMA_MODEL;

    return {
      provider,
      model,
      ollamaChatUrl: this.configService.get<string>("OLLAMA_CHAT_URL") || OLLAMA_URL,
      openAiApiKey: this.configService.get<string>("OPENAI_API_KEY") || "",
      temperature: this.parseTemperature(this.configService.get<string>("LLM_TEMPERATURE"))
    };
  }

  private parseProvider(value: string | undefined): LlmProvider {
    if (value === LlmProvider.OpenAI) {
      return LlmProvider.OpenAI;
    }

    return LlmProvider.Ollama;
  }

  private parseTemperature(value: string | undefined): number {
    const parsed = Number(value ?? "0.1");
    if (!Number.isFinite(parsed)) {
      return 0.1;
    }

    return Math.min(2, Math.max(0, parsed));
  }
}
