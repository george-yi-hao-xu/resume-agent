import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PatchProviderResult } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmService } from "./llm.service";
import type { GeneratePatchesRequest, LlmStatusResponse } from "./llm.types";

@Controller("llm")
export class LlmController {
	constructor(
		@Inject(LlmService) private readonly llmService: LlmService,
		@Inject(StructuredLogger)
		private readonly logger: StructuredLogger,
	) {}

	@Post("patches")
	async getPatches(
		@Body() body: GeneratePatchesRequest,
		@Headers("x-request-id") requestIdHeader?: string,
	): Promise<PatchProviderResult> {
		const requestId = requestIdHeader || randomUUID();
		this.logger.info("llm_request_received", {
			requestId,
			instructionLength: body.instruction.length,
			allowedCssCustomPropertiesCount:
				body.allowedCssCustomProperties?.length ?? 0,
			conversationHistoryCount: body.conversationHistory?.length ?? 0,
			resumeSummaryLength:
				(body.resumeSummary ?? body.resumeStructure ?? "").length,
			resumeDomLength: body.resumeDom?.length ?? 0,
		});

		return this.llmService.getPatchesFromInstruction(
			body,
			requestId,
		);
	}

	@Get("status")
	async getStatus(): Promise<LlmStatusResponse> {
		return this.llmService.getStatus();
	}

	@Post("warmup")
	async warmup(): Promise<{ ok: boolean }> {
		return {
			ok: await this.llmService.warmupOllama(),
		};
	}
}
