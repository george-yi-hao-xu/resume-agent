import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StructuredLogger } from "./structured-logger";

describe("StructuredLogger", () => {
	const originalEnv = { ...process.env };
	let tempDir: string;
	let logPath: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "structured-logger-"));
		logPath = join(tempDir, "app.jsonl");
		process.env = {
			...originalEnv,
			LOG_FILE_PATH: logPath,
			LOG_MAX_BYTES: "5242880",
			LOG_MAX_FILES: "5",
			LOG_CONSOLE_MIRROR: "all",
			LOG_SPLIT_BY_EVENT: "true",
		};
	});

	afterEach(() => {
		jest.restoreAllMocks();
		process.env = { ...originalEnv };
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("writes redacted JSONL entries and mirrors to console", () => {
		const consoleSpy = jest
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const logger = new StructuredLogger();

		logger.info("test_event", {
			openAiApiKey: "sk-secret",
			authorization: "Bearer abc.def",
			rawOutput: "token sk-another-secret",
		});

		const filePayload = readSingleJsonLine(logPath);
		const eventFilePayload = readSingleJsonLine(
			join(tempDir, "events", "test_event.jsonl"),
		);
		expect(filePayload).toMatchObject({
			level: "info",
			event: "test_event",
			openAiApiKey: "[REDACTED]",
			authorization: "[REDACTED]",
			rawOutput: "token [REDACTED]",
		});
		expect(eventFilePayload).toMatchObject(filePayload);
		expect(JSON.parse(consoleSpy.mock.calls[0][0])).toMatchObject(
			filePayload,
		);
	});

	it("splits logs into files named after the event", () => {
		jest.spyOn(console, "info").mockImplementation(() => undefined);
		const logger = new StructuredLogger();

		logger.info("LLM request completed, result from llm:", {
			requestId: "request-1",
		});
		logger.info("http_request_completed", { requestId: "request-2" });

		expect(
			readSingleJsonLine(
				join(
					tempDir,
					"events",
					"llm_request_completed_result_from_llm.jsonl",
				),
			),
		).toMatchObject({
			event: "LLM request completed, result from llm:",
			requestId: "request-1",
		});
		expect(
			readSingleJsonLine(
				join(tempDir, "events", "http_request_completed.jsonl"),
			),
		).toMatchObject({
			event: "http_request_completed",
			requestId: "request-2",
		});
	});

	it("can mirror only errors to console", () => {
		process.env.LOG_CONSOLE_MIRROR = "errors";
		const infoSpy = jest
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const errorSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const logger = new StructuredLogger();

		logger.info("info_event");
		logger.error("error_event");

		expect(infoSpy).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledTimes(1);
		expect(readJsonLines(logPath).map((entry) => entry.event)).toEqual([
			"info_event",
			"error_event",
		]);
	});

	it("rotates logs by size and keeps the configured number of files", () => {
		process.env.LOG_MAX_BYTES = "80";
		process.env.LOG_MAX_FILES = "2";
		const consoleSpy = jest
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const logger = new StructuredLogger();

		logger.info("first", { value: "a".repeat(20) });
		logger.info("second", { value: "b".repeat(20) });
		logger.info("third", { value: "c".repeat(20) });
		logger.info("fourth", { value: "d".repeat(20) });

		expect(consoleSpy).toHaveBeenCalledTimes(4);
		expect(
			readdirSync(tempDir)
				.filter((name) => name.startsWith("app"))
				.sort(),
		).toEqual(["app.1.jsonl", "app.2.jsonl", "app.jsonl"]);
		expect(readJsonLines(logPath).at(-1)).toMatchObject({
			event: "fourth",
		});
		expect(
			readJsonLines(join(tempDir, "app.1.jsonl")).at(-1),
		).toMatchObject({ event: "third" });
		expect(
			readJsonLines(join(tempDir, "app.2.jsonl")).at(-1),
		).toMatchObject({ event: "second" });
	});

	it("falls back to console error when file writes fail", () => {
		process.env.LOG_FILE_PATH = tempDir;
		jest.spyOn(console, "info").mockImplementation(() => undefined);
		const errorSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const logger = new StructuredLogger();

		logger.info("test_event");

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("log_file_write_failed"),
		);
	});
});

function readSingleJsonLine(filePath: string): Record<string, unknown> {
	const entries = readJsonLines(filePath);
	expect(entries).toHaveLength(1);
	return entries[0];
}

function readJsonLines(filePath: string): Array<Record<string, unknown>> {
	return readFileSync(filePath, "utf8")
		.trim()
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}
