import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { LlmModule } from "./llm/llm.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    LlmModule
  ],
  controllers: [HealthController]
})
export class AppModule {}
