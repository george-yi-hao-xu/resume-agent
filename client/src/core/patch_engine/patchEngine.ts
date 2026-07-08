import { PatchAction, type PatchResult, type UiPatch } from "../../types";
import type { Resume } from "@repo/schema/src/resume.types";
import { clonePagePatcher } from "./clone_page_patcher";
import { cssPatcher } from "./css_patcher";
import { insertHtmlPatcher } from "./insert_html_patcher";
import { removeElementPatcher } from "./remove_element_patcher";
import { updateElementAttrPatcher } from "./update-ele-attr";
import { textPatcher } from "./text_patcher";
import { translatePagePatcher } from "./translate_page_patcher";

export type ResumeVTreePatchResult = {
	new: Resume;
	results: PatchResult[];
	changed: boolean;
};

export function apply(r: Resume, patches: UiPatch[]): ResumeVTreePatchResult {
	const beforeTree = cloneJson(r);
	const nextTree = cloneJson(r);

	if (!Array.isArray(patches)) {
		return {
			new: nextTree,
			results: [
				{
					ok: false,
					action: PatchAction.Unknown,
					message: "Patch payload must be an array.",
				},
			],
			changed: false,
		};
	}

	const results = patches.map((patch) => applyPatch(nextTree, patch));
	const afterTree = cloneJson(nextTree);

	return {
		new: afterTree,
		results,
		changed: JSON.stringify(beforeTree) !== JSON.stringify(afterTree),
	};
}

function applyPatch(tree: Resume, patch: UiPatch): PatchResult {
	try {
		if (!patch || typeof patch !== "object") {
			console.warn("Bad patch: ", patch)
			return {
				ok: false,
				action: PatchAction.Unknown,
				message: "Patch item must be an object.",
			};
		}

		switch (patch.action) {
			case PatchAction.UpdateCss:
				return cssPatcher(tree, patch.selector, patch.styles);
			case PatchAction.UpdateText:
				return textPatcher(
					tree,
					patch.selector,
					"from" in patch ? String(patch.from ?? "") : "",
					"to" in patch ? String(patch.to ?? "") : "",
				);
			case PatchAction.UpdateElementAttr:
				return updateElementAttrPatcher(tree, patch.selector, patch.attributes);
			case PatchAction.InsertElement:
				return insertHtmlPatcher(tree, patch);
			case PatchAction.RemoveElement:
				return removeElementPatcher(tree, patch.selector);
			case PatchAction.ClonePage:
				return clonePagePatcher(tree, patch);
			case PatchAction.TranslatePage:
				return translatePagePatcher(tree, patch);
			default:
				return {
					ok: false,
					action: PatchAction.Unknown,
					message: "Unknown patch action ignored.",
				};
		}
	} catch (error) {
		const action = isPatchLike(patch) ? patch.action : PatchAction.Unknown;
		return {
			ok: false,
			action,
			message: getPatchErrorMessage(action, error),
		};
	}
}

function getPatchErrorMessage(action: PatchAction, error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string" && error.trim()) {
		return error;
	}
	return `${action} patch failed.`;
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}



function isPatchLike(value: unknown): value is { action: PatchAction } {
	return !!value && typeof value === "object" && "action" in value;
}
