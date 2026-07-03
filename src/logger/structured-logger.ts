import { Injectable } from "@nestjs/common";
import { existsSync, mkdirSync, renameSync, rmSync, statSync, appendFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path";

const MAX_LOG_FIELD_LENGTH = 20_000;
const DEFAULT_LOG_FILE_PATH = "logs/app.jsonl";
const DEFAULT_LOG_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_LOG_MAX_FILES = 5;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/g
];

export type LogFields = Record<string, unknown>;
type LogLevel = "info" | "warn" | "error";
type ConsoleMirrorMode = "all" | "errors" | "none";

@Injectable()
export class StructuredLogger {
  info(event: string, fields: LogFields = {}): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields: LogFields = {}): void {
    this.write("warn", event, fields);
  }

  error(event: string, fields: LogFields = {}): void {
    this.write("error", event, fields);
  }

  private write(level: LogLevel, event: string, fields: LogFields): void {
    const payload = redactValue({
      level,
      event,
      time: new Date().toISOString(),
      ...fields
    });
    const line = `${JSON.stringify(payload)}\n`;

    this.writeToFiles(event, line);
    this.writeToConsole(level, line.trimEnd());
  }

  private writeToFiles(event: string, line: string): void {
    const appLogFilePath = getLogFilePath();
    this.writeToFile(appLogFilePath, line);

    if (shouldSplitByEvent()) {
      this.writeToFile(getEventLogFilePath(appLogFilePath, event), line);
    }
  }

  private writeToFile(filePath: string, line: string): void {
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      rotateIfNeeded(filePath, Buffer.byteLength(line), getLogMaxBytes(), getLogMaxFiles());
      appendFileSync(filePath, line, "utf8");
    } catch (error) {
      console.error(JSON.stringify({
        level: "error",
        event: "log_file_write_failed",
        time: new Date().toISOString(),
        filePath,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  }

  private writeToConsole(level: LogLevel, line: string): void {
    const mirrorMode = getConsoleMirrorMode();
    if (mirrorMode === "none" || (mirrorMode === "errors" && level !== "error")) {
      return;
    }

    console[level](line);
  }
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (isSecretKey(key)) {
          return [key, "[REDACTED]"];
        }

        return [key, redactValue(item)];
      })
    );
  }

  return value;
}

function redactString(value: string): string {
  const redacted = SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), value);
  if (redacted.length <= MAX_LOG_FIELD_LENGTH) {
    return redacted;
  }

  return `${redacted.slice(0, MAX_LOG_FIELD_LENGTH)}...[truncated ${redacted.length - MAX_LOG_FIELD_LENGTH} chars]`;
}

function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("apikey") || normalized.includes("api_key") || normalized.includes("authorization") || normalized.includes("token");
}

function getLogFilePath(): string {
  const configuredPath = process.env.LOG_FILE_PATH?.trim() || DEFAULT_LOG_FILE_PATH;
  return isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
}

function getEventLogFilePath(appLogFilePath: string, event: string): string {
  const extension = extname(appLogFilePath) || ".jsonl";
  return join(dirname(appLogFilePath), "events", `${sanitizeEventName(event)}${extension}`);
}

function sanitizeEventName(event: string): string {
  const safeName = event
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return safeName || "unknown_event";
}

function shouldSplitByEvent(): boolean {
  const value = process.env.LOG_SPLIT_BY_EVENT?.trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "none";
}

function getLogMaxBytes(): number {
  return parsePositiveInt(process.env.LOG_MAX_BYTES, DEFAULT_LOG_MAX_BYTES);
}

function getLogMaxFiles(): number {
  return parsePositiveInt(process.env.LOG_MAX_FILES, DEFAULT_LOG_MAX_FILES);
}

function getConsoleMirrorMode(): ConsoleMirrorMode {
  const value = process.env.LOG_CONSOLE_MIRROR?.trim().toLowerCase();
  if (value === "none" || value === "errors") {
    return value;
  }

  return "all";
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function rotateIfNeeded(filePath: string, incomingBytes: number, maxBytes: number, maxFiles: number): void {
  if (!existsSync(filePath)) {
    return;
  }

  const currentSize = statSync(filePath).size;
  if (currentSize === 0 || currentSize + incomingBytes <= maxBytes) {
    return;
  }

  const oldestPath = getRotatedLogPath(filePath, maxFiles);
  if (existsSync(oldestPath)) {
    rmSync(oldestPath, { force: true });
  }

  for (let index = maxFiles - 1; index >= 1; index -= 1) {
    const source = getRotatedLogPath(filePath, index);
    if (existsSync(source)) {
      renameSync(source, getRotatedLogPath(filePath, index + 1));
    }
  }

  renameSync(filePath, getRotatedLogPath(filePath, 1));
}

function getRotatedLogPath(filePath: string, index: number): string {
  const extension = extname(filePath);
  if (!extension) {
    return `${filePath}.${index}`;
  }

  return join(dirname(filePath), `${basename(filePath, extension)}.${index}${extension}`);
}
