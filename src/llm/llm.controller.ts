import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PatchProviderResult } from "../../client/src/types";
import { LlmService } from "./llm.service";
import type { GeneratePatchesRequest, LlmStatusResponse } from "./llm.types";

@Controller("llm")
export class LlmController {
  constructor(@Inject(LlmService) private readonly llmService: LlmService) {}

  @Post("patches")
  async getPatches(
    @Body() body: GeneratePatchesRequest,
    @Headers("x-request-id") requestIdHeader?: string
  ): Promise<PatchProviderResult> {
    return this.llmService.getPatchesFromInstruction(body, requestIdHeader || randomUUID());
  }

  @Get("status")
  async getStatus(): Promise<LlmStatusResponse> {
    return this.llmService.getStatus();
  }

  @Post("warmup")
  async warmup(): Promise<{ ok: boolean }> {
    return {
      ok: await this.llmService.warmupOllama()
    };
  }
}
