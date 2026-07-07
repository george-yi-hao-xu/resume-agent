import { CHAT_ROLE, type GetPatchesOptions } from "@repo/schema";
import type { RunPatchState } from "./run.js";

const MAX_INSTRUCTION_LENGTH = 20_000;
const MAX_TEXT_LENGTH = 200_000;
const MAX_HISTORY_MESSAGES = 50;

// Normalize the incoming request so the rest of the pipeline can assume
// consistent types and avoid carrying user-supplied junk further downstream.
export function cleanInput(state: RunPatchState): RunPatchState {
	const request = sanitizeRequest(state.request);
	const resumeDom = request.resumeDom ?? "";
	const resumeSummary = request.resumeSummary ?? "";
	return {
		...state,
		request,
		useFullDom: state.useFullDom || resumeDom.length > resumeSummary.length,
	};
}

function sanitizeRequest(body: GetPatchesOptions): GetPatchesOptions {
	const instruction = clampText(body.instruction).trim();
	if (!instruction) {
		throw new Error("instruction is required.");
	}

	return {
		instruction: instruction.slice(0, MAX_INSTRUCTION_LENGTH),
		allowClassNames: uniqueStrings(
			body.allowClassNames ?? [],
		),
		conversationHistory: sanitizeConversationHistory(
			body.conversationHistory ?? [],
		),
		resumeSummary: clampText(body.resumeSummary ?? "").trim(),
		resumeDom: clampText(body.resumeDom ?? ""),
		resumeStructure: clampText(body.resumeStructure ?? "").trim(),
	};
}

function sanitizeConversationHistory(
	messages: NonNullable<GetPatchesOptions["conversationHistory"]>,
): NonNullable<GetPatchesOptions["conversationHistory"]> {
	return messages
		.filter((message): message is NonNullable<typeof message> => !!message)
		.slice(-MAX_HISTORY_MESSAGES)
		.map((message) => {
			const role = isChatRole(message.role) ? message.role : CHAT_ROLE.USER;
			const content = clampText(message.content ?? "").trim();
			if (!content) {
				return null;
			}

			return {
				...message,
				role,
				content,
			};
		})
		.filter(
			(message): message is NonNullable<typeof message> => message !== null,
		);
}

function uniqueStrings(values: unknown[]): string[] {
	const result: string[] = [];
	const seen = new Set<string>();

	for (const value of values) {
		if (typeof value !== "string") {
			continue;
		}

		const normalized = value.trim();
		if (!normalized || seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		result.push(normalized);
	}

	return result;
}

function clampText(value: string): string {
	return value.length > MAX_TEXT_LENGTH
		? value.slice(0, MAX_TEXT_LENGTH)
		: value;
}

function isChatRole(value: unknown): value is CHAT_ROLE {
	return value === CHAT_ROLE.USER || value === CHAT_ROLE.ASSISTANT || value === CHAT_ROLE.SYSTEM;
}
