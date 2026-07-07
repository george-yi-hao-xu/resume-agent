import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, Observable, of, throwError } from "rxjs";
import { HttpLoggingInterceptor } from "./http-logging.interceptor";
import type { StructuredLogger } from "./structured-logger";

describe("HttpLoggingInterceptor", () => {
	it("logs completed HTTP requests", async () => {
		const logger = createLogger();
		const interceptor = new HttpLoggingInterceptor(logger);
		const context = createHttpContext(
			{
				method: "GET",
				originalUrl: "/api/health",
				headers: {
					"x-request-id": "request-1",
				},
			},
			{
				statusCode: 200,
			},
		);

		await expect(
			lastValueFrom(
				interceptor.intercept(context, createHandler(of({ ok: true }))),
			),
		).resolves.toEqual({ ok: true });

		expect(logger.info).toHaveBeenCalledWith(
			"http_request_completed",
			expect.objectContaining({
				requestId: "request-1",
				method: "GET",
				url: "/api/health",
				statusCode: 200,
				durationMs: expect.any(Number),
			}),
		);
	});

	it("logs failed HTTP requests", async () => {
		const logger = createLogger();
		const interceptor = new HttpLoggingInterceptor(logger);
		const error = Object.assign(new Error("Boom"), { status: 503 });

		await expect(
			lastValueFrom(
				interceptor.intercept(
					createHttpContext(
						{
							method: "GET",
							originalUrl: "/api/llm/status",
							headers: {},
						},
						{ statusCode: 500 },
					),
					createHandler(throwError(() => error)),
				),
			),
		).rejects.toThrow("Boom");

		expect(logger.error).toHaveBeenCalledWith(
			"http_request_failed",
			expect.objectContaining({
				method: "GET",
				url: "/api/llm/status",
				statusCode: 503,
				error: "Boom",
				durationMs: expect.any(Number),
			}),
		);
	});
});

function createLogger(): StructuredLogger {
	return {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	} as unknown as StructuredLogger;
}

function createHandler(observable: Observable<unknown>): CallHandler {
	return {
		handle: () => observable,
	};
}

function createHttpContext(
	request: unknown,
	response: unknown,
): ExecutionContext {
	return {
		getType: () => "http",
		switchToHttp: () => ({
			getRequest: () => request,
			getResponse: () => response,
		}),
	} as unknown as ExecutionContext;
}
