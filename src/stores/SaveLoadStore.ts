import { CHAT_ROLE, PatchAction, type ChatMessage, type PatchResult, type UiPatch } from "../types";
import type { ChatSnapshot, ChatStore } from "./ChatStore";
import type { ResumeSnapshot, ResumeStore } from "./ResumeStore";
import type { SettingSnapshot, SettingStore } from "./SettingStore";

export const SNAPSHOT_VERSION = 1;

export type AppSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  savedAt: string;
  resume: ResumeSnapshot;
  settings: SettingSnapshot;
  chat: ChatSnapshot;
};

export class SaveLoadStore {
  constructor(
    private readonly resumeStore: ResumeStore,
    private readonly settingStore: SettingStore,
    private readonly chatStore: ChatStore
  ) {}

  exportJson(): string {
    return JSON.stringify(this.getSnapshot(), null, 2);
  }

  downloadSnapshot(): void {
    const blob = new Blob([this.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getSnapshotFileName();
    anchor.click();

    URL.revokeObjectURL(url);
  }

  async importFile(file: File): Promise<void> {
    const text = await file.text();
    this.importJson(text);
  }

  importJson(json: string): void {
    const snapshot = parseSnapshot(json);

    this.settingStore.loadSnapshot(snapshot.settings);
    this.chatStore.loadSnapshot(snapshot.chat);
    this.resumeStore.loadSnapshot(snapshot.resume);
  }

  getSnapshot(): AppSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      savedAt: new Date().toISOString(),
      resume: this.resumeStore.getSnapshot(),
      settings: this.settingStore.getSnapshot(),
      chat: this.chatStore.getSnapshot()
    };
  }
}

export function parseSnapshot(json: string): AppSnapshot {
  const parsed = JSON.parse(json) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Snapshot must be a JSON object.");
  }

  if (parsed.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version: ${String(parsed.version)}.`);
  }

  if (typeof parsed.savedAt !== "string") {
    throw new Error("Snapshot is missing savedAt.");
  }

  return {
    version: SNAPSHOT_VERSION,
    savedAt: parsed.savedAt,
    resume: parseResumeSnapshot(parsed.resume),
    settings: parseSettingSnapshot(parsed.settings),
    chat: parseChatSnapshot(parsed.chat)
  };
}

function parseResumeSnapshot(value: unknown): ResumeSnapshot {
  if (!isRecord(value) || typeof value.html !== "string") {
    throw new Error("Snapshot resume state is invalid.");
  }

  return {
    html: value.html
  };
}

function parseSettingSnapshot(value: unknown): SettingSnapshot {
  if (
    !isRecord(value) ||
    typeof value.llmName !== "string" ||
    typeof value.backEndUrl !== "string" ||
    typeof value.temperature !== "number" ||
    !Number.isFinite(value.temperature)
  ) {
    throw new Error("Snapshot settings state is invalid.");
  }

  return {
    llmName: value.llmName,
    backEndUrl: value.backEndUrl,
    temperature: value.temperature
  };
}

function parseChatSnapshot(value: unknown): ChatSnapshot {
  if (!isRecord(value) || !Array.isArray(value.messages) || !Array.isArray(value.results)) {
    throw new Error("Snapshot chat state is invalid.");
  }

  return {
    messages: value.messages.map(parseChatMessage),
    results: value.results.map(parsePatchResult)
  };
}

function parseChatMessage(value: unknown): ChatMessage {
  if (!isRecord(value)) {
    throw new Error("Snapshot chat message is invalid.");
  }

  if (
    typeof value.id !== "string" ||
    !isChatRole(value.role) ||
    typeof value.content !== "string" ||
    (value.provider !== undefined && value.provider !== "ollama") ||
    (value.patches !== undefined && !Array.isArray(value.patches))
  ) {
    throw new Error("Snapshot chat message is invalid.");
  }

  return {
    id: value.id,
    role: value.role,
    content: value.content,
    provider: value.provider,
    patches: value.patches as UiPatch[] | undefined
  };
}

function parsePatchResult(value: unknown): PatchResult {
  if (
    !isRecord(value) ||
    typeof value.ok !== "boolean" ||
    !isPatchAction(value.action) ||
    typeof value.message !== "string"
  ) {
    throw new Error("Snapshot patch result is invalid.");
  }

  return {
    ok: value.ok,
    action: value.action,
    message: value.message
  };
}

function isChatRole(value: unknown): value is CHAT_ROLE {
  return value === CHAT_ROLE.SYSTEM || value === CHAT_ROLE.USER || value === CHAT_ROLE.ASSISTANT;
}

function isPatchAction(value: unknown): value is PatchAction {
  return Object.values(PatchAction).includes(value as PatchAction);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSnapshotFileName(date = new Date()): string {
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");

  return `agent-resume-snapshot-${timestamp}.json`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
