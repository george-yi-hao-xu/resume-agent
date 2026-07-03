import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { StructuredLogger } from "./logger/structured-logger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false
  });
  app.setGlobalPrefix("api");

  const port = Number(process.env.SERVER_PORT ?? 3001);
  const host = process.env.SERVER_HOST ?? "0.0.0.0";
  await app.listen(port, host);
  const logger = app.get(StructuredLogger, { strict: false });
  logger.info("server_started", {
    host,
    port
  });
}

void bootstrap();
