// SaveLoadStore.ts

import type { ChatSnapshot, ChatStore } from "./ChatStore";
import type { ResumeStore } from "./ResumeStore";
import type { Resume } from "@repo/schema/src/resume.types";
import type { SettingSnapshot, SettingStore } from "./SettingStore";
import { default_manifest } from "../core/default_manifest";
import { isResume } from "../core/validator/resume_validator";
import { parseSettingSnapshot } from "../core/validator/setting_validator";
import { isRecord } from "../core/utils";
import { parseChatSnapshot } from "../core/validator/chatmsg_validator";

export const SNAPSHOT_VERSION = 2;

export type AppSnapshot = {
	version: typeof SNAPSHOT_VERSION;
	savedAt: string;
	resume: Resume;
	settings: SettingSnapshot;
	chat: ChatSnapshot;
};

export class SaveLoadStore {
	constructor(
		private readonly resumeStore: ResumeStore,
		private readonly settingStore: SettingStore,
		private readonly chatStore: ChatStore,
	) {}

	exportJson(): string {
		return JSON.stringify(this.getSnapshot(), null, 2);
	}

	downloadSnapshot(): void {
		const blob = new Blob([this.exportJson()], {
			type: "application/json",
		});
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
			chat: this.chatStore.getSnapshot(),
		};
	}
}

export function parseSnapshot(json: string): AppSnapshot {
	const parsed = JSON.parse(json) as unknown;

	if (!isRecord(parsed)) {
		throw new Error("Snapshot must be a JSON object.");
	}

	if (parsed.version !== SNAPSHOT_VERSION) {
		throw new Error(
			`Unsupported snapshot version: ${String(parsed.version)}.`,
		);
	}

	if (typeof parsed.savedAt !== "string") {
		throw new Error("Snapshot is missing savedAt.");
	}

	if (parsed.resume !== undefined && !isResume(parsed.resume)) {
		throw new Error("Snapshot resume state is invalid.");
	}

	return {
		version: SNAPSHOT_VERSION,
		savedAt: parsed.savedAt,
		resume: parsed.resume ?? default_manifest,
		settings: parseSettingSnapshot(parsed.settings),
		chat: parseChatSnapshot(parsed.chat),
	};
}


function getSnapshotFileName(date = new Date()): string {
	const timestamp = [
		date.getFullYear(),
		pad(date.getMonth() + 1),
		pad(date.getDate()),
		"-",
		pad(date.getHours()),
		pad(date.getMinutes()),
		pad(date.getSeconds()),
	].join("");

	return `agent-resume-snapshot-${timestamp}.json`;
}

function pad(value: number): string {
	return String(value).padStart(2, "0");
}
