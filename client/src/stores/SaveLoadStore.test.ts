import { default_manifest } from "../core/default_manifest";
import { CHAT_ROLE, PatchAction } from "../types";
import {
	parseSnapshot,
	SNAPSHOT_VERSION,
	type AppSnapshot,
} from "./SaveLoadStore";

const snapshot: AppSnapshot = {
	version: SNAPSHOT_VERSION,
	savedAt: "2026-07-02T00:00:00.000Z",
	resume: default_manifest,
	settings: {
		llmName: "llama3.2",
		backEndUrl: "http://localhost:11434",
		temperature: 0.2,
	},
	chat: {
		messages: [
			{
				id: "message-1",
				role: CHAT_ROLE.USER,
				content: "Update title",
			},
		],
		results: [
			{
				ok: true,
				action: PatchAction.UpdateText,
				message: "Updated title",
			},
		],
	},
};

describe("SaveLoadStore snapshots", () => {
	it("parses a complete app snapshot", () => {
		expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
	});

	it("rejects unsupported versions", () => {
		expect(() =>
			parseSnapshot(JSON.stringify({ ...snapshot, version: 999 })),
		).toThrow("Unsupported snapshot version");
	});

	it("rejects version 1 resume html snapshots", () => {
		expect(() =>
			parseSnapshot(
				JSON.stringify({
					...snapshot,
					resume: {
						html: "<!doctype html><html><body><main data-resume-root></main></body></html>",
					},
				}),
			),
		).toThrow("Snapshot resume state is invalid");
	});

	it("falls back to the default manifest when resume is missing", () => {
		const parsed = parseSnapshot(
			JSON.stringify({
				...snapshot,
				resume: undefined,
			}),
		);

		expect(parsed.resume).toEqual(default_manifest);
	});

	it("rejects missing chat state", () => {
		const { chat, ...invalidSnapshot } = snapshot;

		expect(() => parseSnapshot(JSON.stringify(invalidSnapshot))).toThrow(
			"Snapshot chat state is invalid",
		);
	});
});
