import { Module } from "@nestjs/common";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmConfig } from "./llm.config";
import { LlmController } from "./llm.controller";
import { LlmService } from "./llm.service";

@Module({
  controllers: [LlmController],
  providers: [LlmConfig, LlmService, StructuredLogger],
  exports: [LlmService]
})
export class LlmModule {}
