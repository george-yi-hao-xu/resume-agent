import { Inject, Injectable } from "@nestjs/common";
import type { PatchProviderResult } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import {
	LlmProviderService,
	getOllamaChatUrl,
	getOllamaTagsUrl,
} from "./llm-provider.service";
import { PatchWorkflowService } from "./llm.patch-workflow.service";
import type { GeneratePatchesRequest, LlmStatusResponse } from "./llm.types";

@Injectable()
export class LlmService {
	constructor(
		@Inject(LlmConfig)
		private readonly llmConfig: LlmConfig,
		@Inject(StructuredLogger)
		private readonly logger: StructuredLogger,
		@Inject(LlmProviderService)
		private readonly providerService: LlmProviderService,
		@Inject(PatchWorkflowService)
		private readonly patchWorkflowService: PatchWorkflowService,
	) {}

	async getPatchesFromInstruction(
		request: GeneratePatchesRequest,
		requestId: string,
	): Promise<PatchProviderResult> {
		return this.patchWorkflowService.run(request, requestId);
	}

	async getStatus(): Promise<LlmStatusResponse> {
		return this.providerService.getStatus(
			this.llmConfig.getRuntimeConfig(),
		);
	}

	async warmupOllama(): Promise<boolean> {
		return this.providerService.warmupOllama(
			this.llmConfig.getRuntimeConfig(),
		);
	}
}

export { getOllamaChatUrl, getOllamaTagsUrl };
