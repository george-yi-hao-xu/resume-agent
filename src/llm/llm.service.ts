import { Inject, Injectable } from "@nestjs/common";
import type { PatchProviderResult } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import { LlmProviderService, getOllamaChatUrl, getOllamaTagsUrl } from "./llm-provider.service";
import { extractHtmlDocument } from "./llm.patch-parser";
import { runPatchWorkflow } from "./llm.patch-workflow";
import { buildWildDomMessages } from "./llm.prompt-builder";
import type { GeneratePatchesRequest, GenerateWildDomRequest, LlmStatusResponse, WildDomProviderResult } from "./llm.types";

@Injectable()
export class LlmService {
  constructor(
    @Inject(LlmConfig)
    private readonly llmConfig: LlmConfig,
    @Inject(StructuredLogger)
    private readonly logger: StructuredLogger,
    @Inject(LlmProviderService)
    private readonly providerService: LlmProviderService
  ) {}

  async getPatchesFromInstruction(request: GeneratePatchesRequest, requestId: string): Promise<PatchProviderResult> {
    const config = this.llmConfig.getRuntimeConfig();
    const startedAt = Date.now();

    try {
      const state = await runPatchWorkflow(
        {
          request,
          requestId,
          startedAt
        },
        {
          config,
          logger: this.logger,
          providerService: this.providerService
        }
      );

      if (!state.result) {
        throw new Error("Patch workflow did not produce a result.");
      }

      return state.result;
    } catch (error) {
      this.logger.error("llm_request_failed", {
        requestId,
        provider: config.provider,
        model: config.model,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getWildDomFromInstruction(request: GenerateWildDomRequest, requestId: string): Promise<WildDomProviderResult> {
    const config = this.llmConfig.getRuntimeConfig();
    const startedAt = Date.now();
    const messages = buildWildDomMessages(
      request.instruction,
      request.conversationHistory ?? [],
      request.resumeDom ?? ""
    );

    this.logger.info("llm_wild_dom_request_started", {
      requestId,
      provider: config.provider,
      model: config.model,
      messageCount: messages.length,
      instruction: request.instruction,
      resumeDomLength: request.resumeDom?.length ?? 0
    });

    try {
      const result = await this.providerService.callRaw(config, messages);
      const html = extractHtmlDocument(result.rawContent);

      this.logger.info("llm_wild_dom_request_completed", {
        requestId,
        provider: config.provider,
        model: config.model,
        durationMs: Date.now() - startedAt,
        usage: result.usage,
        rawOutput: result.rawContent,
        htmlLength: html.length
      });

      return {
        html,
        provider: config.provider,
        model: config.model,
        usage: result.usage,
        note: "Wild mode replaced the preview with the model returned DOM."
      };
    } catch (error) {
      this.logger.error("llm_wild_dom_request_failed", {
        requestId,
        provider: config.provider,
        model: config.model,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async getStatus(): Promise<LlmStatusResponse> {
    return this.providerService.getStatus(this.llmConfig.getRuntimeConfig());
  }

  async warmupOllama(): Promise<boolean> {
    return this.providerService.warmupOllama(this.llmConfig.getRuntimeConfig());
  }
}

export { getOllamaChatUrl, getOllamaTagsUrl };
