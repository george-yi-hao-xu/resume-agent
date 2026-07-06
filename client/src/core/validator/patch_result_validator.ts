import { PatchResult } from "../../types";
import { isRecord } from "../utils";
import { PatchAction } from "../../types";

export function parsePatchResult(value: unknown): PatchResult {
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
		message: value.message,
	};
}

function isPatchAction(value: unknown): value is PatchAction {
	return Object.values(PatchAction).includes(value as PatchAction);
}

