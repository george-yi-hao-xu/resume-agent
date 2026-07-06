import { PatchAction, type PatchResult, type UiPatch } from "../../types";
import type { Resume } from "../../resume.types";
import { clonePagePatcher } from "./clone_page_patcher";
import { cssPatcher } from "./css_patcher";
import { insertHtmlPatcher } from "./insert_html_patcher";
import { removeElementPatcher } from "./remove_element_patcher";
import { sectionLayoutPatcher } from "./section_layout_patcher";
import { textPatcher } from "./text_patcher";

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
		switch (patch.action) {
			case PatchAction.UpdateCss:
				return cssPatcher(tree, patch.selector, patch.styles);
			case PatchAction.UpdateText:
				return textPatcher(tree, patch.selector, patch.text);
			case PatchAction.InsertHtml:
				return insertHtmlPatcher(tree, patch);
			case PatchAction.RemoveElement:
				return removeElementPatcher(tree, patch.selector);
			case PatchAction.SetSectionLayout:
				return sectionLayoutPatcher(tree, patch);
			case PatchAction.ClonePage:
				return clonePagePatcher(tree, patch);
			default:
				return {
					ok: false,
					action: PatchAction.Unknown,
					message: "Unknown patch action ignored.",
				};
		}
	} catch (error) {
		return {
			ok: false,
			action: "action" in patch ? patch.action : PatchAction.Unknown,
			message: getPatchErrorMessage(patch.action, error),
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
