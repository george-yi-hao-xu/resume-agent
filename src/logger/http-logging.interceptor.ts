import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { catchError, tap, throwError } from "rxjs";
import { StructuredLogger } from "./structured-logger";

type HttpRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type HttpResponse = {
  statusCode?: number;
};

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(StructuredLogger) private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();
    const method = request.method ?? "UNKNOWN";
    const url = request.originalUrl ?? request.url ?? "";
    const requestId = getRequestId(request);

    return next.handle().pipe(
      tap(() => {
        this.logger.info("http_request_completed", {
          requestId,
          method,
          url,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt
        });
      }),
      catchError((error: unknown) => {
        const statusCode = getErrorStatusCode(error) ?? response.statusCode ?? 500;
        this.logger.error("http_request_failed", {
          requestId,
          method,
          url,
          statusCode,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error)
        });
        return throwError(() => error);
      })
    );
  }
}

function getRequestId(request: HttpRequest): string {
  const headerValue = request.headers?.["x-request-id"];
  if (Array.isArray(headerValue)) {
    return headerValue[0] || randomUUID();
  }

  return headerValue || randomUUID();
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const status = (error as { status?: unknown; statusCode?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
  return typeof status === "number" ? status : undefined;
}
