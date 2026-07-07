import { Module } from "@nestjs/common";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import { LlmController } from "./llm.controller";
import { LlmProviderService } from "./llm-provider.service";
import { PatchWorkflowService } from "./llm.patch-workflow.service";
import { LlmService } from "./llm.service";

@Module({
	controllers: [LlmController],
	providers: [
		LlmConfig,
		LlmProviderService,
		PatchWorkflowService,
		LlmService,
		StructuredLogger,
	],
	exports: [LlmService],
})
export class LlmModule {}
