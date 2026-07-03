import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false
  });
  app.setGlobalPrefix("api");

  const port = Number(process.env.SERVER_PORT ?? 3001);
  const host = process.env.SERVER_HOST ?? "0.0.0.0";
  await app.listen(port, host);
  console.log(JSON.stringify({
    level: "info",
    event: "server_started",
    host,
    port
  }));
}

void bootstrap();
