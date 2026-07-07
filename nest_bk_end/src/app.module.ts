import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { LlmModule } from "./llm/llm.module";
import { HttpLoggingInterceptor } from "./logger/http-logging.interceptor";
import { StructuredLogger } from "./logger/structured-logger";

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		LlmModule,
	],
	controllers: [HealthController],
	providers: [
		StructuredLogger,
		{
			provide: APP_INTERCEPTOR,
			useClass: HttpLoggingInterceptor,
		},
	],
})
export class AppModule {}
