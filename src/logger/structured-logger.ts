import { Injectable } from "@nestjs/common";

const MAX_LOG_FIELD_LENGTH = 20_000;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/g
];

export type LogFields = Record<string, unknown>;

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

  private write(level: "info" | "warn" | "error", event: string, fields: LogFields): void {
    const payload = redactValue({
      level,
      event,
      time: new Date().toISOString(),
      ...fields
    });
    console[level](JSON.stringify(payload));
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
