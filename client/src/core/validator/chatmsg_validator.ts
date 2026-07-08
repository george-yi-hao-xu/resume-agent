import { isRecord } from "../utils";
import type { ChatMessage } from "@repo/schema";
import { CHAT_ROLE } from "@repo/schema";
import { isLlmProvider } from "./utils";
import type { ResumeDiffOp, UiPatch } from "../../types";
import type { ChatSnapshot, ResumeEditMode } from "../../stores/ChatStore";
import { parsePatchResult } from "./patch_result_validator";

function isChatRole(value: unknown): value is CHAT_ROLE {
	return (
		value === CHAT_ROLE.SYSTEM ||
		value === CHAT_ROLE.USER ||
		value === CHAT_ROLE.ASSISTANT
	);
}

function parseChatMessage(value: unknown): ChatMessage {
	if (!isRecord(value)) {
		throw new Error("Snapshot chat message is invalid.");
	}

	if (
		typeof value.id !== "string" ||
		!isChatRole(value.role) ||
		typeof value.content !== "string" ||
		(value.provider !== undefined && !isLlmProvider(value.provider)) ||
		(value.patches !== undefined && !Array.isArray(value.patches)) ||
		(value.diffs !== undefined && !Array.isArray(value.diffs))
	) {
		throw new Error("Snapshot chat message is invalid.");
	}

	return {
		id: value.id,
		role: value.role,
		content: value.content,
		provider: value.provider,
		patches: value.patches as UiPatch[] | undefined,
		diffs: value.diffs as ResumeDiffOp[] | undefined,
	};
}

export function parseChatSnapshot(value: unknown): ChatSnapshot {
	if (
		!isRecord(value) ||
		!Array.isArray(value.messages) ||
		!Array.isArray(value.results)
	) {
		throw new Error("Snapshot chat state is invalid.");
	}

	return {
		messages: value.messages.map(parseChatMessage),
		results: value.results.map(parsePatchResult),
		editMode: readEditMode(value.editMode),
	};
}

function readEditMode(value: unknown): ResumeEditMode | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === "patch" || value === "diff") {
		return value;
	}
	throw new Error("Snapshot chat edit mode is invalid.");
}
