import { Inject, Injectable } from "@nestjs/common";
import type { LlmUsage, PatchProviderResult, UiPatch } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import { LlmProviderService, getOllamaChatUrl, getOllamaTagsUrl } from "./llm-provider.service";
import { extractHtmlDocument, parsePatchResponse } from "./llm.patch-parser";
import { buildPatchModelMessages, buildWildDomMessages, shouldIncludeFullDom } from "./llm.prompt-builder";
import type { GeneratePatchesRequest, GenerateWildDomRequest, LlmStatusResponse, WildDomProviderResult } from "./llm.types";

type PatchGenerationResult = {
  patches: UiPatch[];
  usage: LlmUsage;
  rawContent: string;
  invalidPatchCount: number;
};

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
    const resumeSummary = request.resumeSummary ?? request.resumeStructure ?? "";
    const resumeDom = request.resumeDom ?? "";
    const usedFullDom = shouldIncludeFullDom(request.instruction, request.conversationHistory ?? []);
    const messages = buildPatchModelMessages(
      request.instruction,
      request.allowedCssCustomProperties ?? [],
      request.conversationHistory ?? [],
      resumeSummary,
      usedFullDom ? resumeDom : ""
    );

    this.logger.info("llm_request_started, instruction/message ready", {
      requestId,
      // provider: config.provider,
      model: config.model,
      // messageCount: messages.length,
      instruction: request.instruction,
      usedFullDom,
      // resumeSummaryLength: resumeSummary.length,
      // resumeDomLength: resumeDom.length
      messages: messages
    });

    try {
      const result = await this.generatePatches(messages);

      this.logger.info("llm_request_completed, result from llm:", {
        requestId,
        provider: config.provider,
        model: config.model,
        durationMs: Date.now() - startedAt,
        usage: result.usage,
        rawOutput: result.rawContent,
        patches: result.patches
      });

      return {
        patches: result.patches,
        provider: config.provider,
        model: config.model,
        usage: result.usage,
        note: result.invalidPatchCount
          ? `Ignored ${result.invalidPatchCount} invalid patch${result.invalidPatchCount === 1 ? "" : "es"} from the model.`
          : undefined
      };
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

  private async generatePatches(messages: Parameters<LlmProviderService["callRaw"]>[1]): Promise<PatchGenerationResult> {
    const result = await this.providerService.callRaw(this.llmConfig.getRuntimeConfig(), messages);
    const parsed = parsePatchResponse(result.rawContent);

    return {
      rawContent: result.rawContent,
      patches: parsed.patches,
      usage: result.usage,
      invalidPatchCount: parsed.invalidPatchCount
    };
  }
}

export { getOllamaChatUrl, getOllamaTagsUrl };
