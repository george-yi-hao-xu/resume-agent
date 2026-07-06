import { Inject, Injectable } from "@nestjs/common";
import type { PatchProviderResult } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import { LlmProviderService } from "./llm-provider.service";
import { runPatchWorkflow } from "./llm.patch-workflow";
import type { GeneratePatchesRequest } from "./llm.types";

@Injectable()
export class PatchWorkflowService {
  constructor(
    @Inject(LlmConfig)
    private readonly llmConfig: LlmConfig,
    @Inject(StructuredLogger)
    private readonly logger: StructuredLogger,
    @Inject(LlmProviderService)
    private readonly providerService: LlmProviderService
  ) {}

  async run(request: GeneratePatchesRequest, requestId: string): Promise<PatchProviderResult> {
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
}
