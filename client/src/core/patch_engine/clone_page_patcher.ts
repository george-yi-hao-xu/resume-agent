import { RESUME_SELECTORS } from "../resumeSelectors";
import type { Resume } from "@repo/schema/src/resume.types";
import {
	PatchAction,
	type PatchResult,
	type UiPatch,
} from "../../types";
import type { MutableNode } from "./patcher.types";
import { cloneJson, queryNodes } from "./utils";

// Set or create a node attribute without repeating null checks at call sites.
function setNodeAttribute(node: MutableNode, name: string, value: string): void {
	node.attributes ??= {};
	node.attributes[name] = value;
}

export function clonePagePatcher(
	r: Resume,
	patch: Extract<UiPatch, { action: PatchAction.ClonePage }>,
): PatchResult {
	const sourceId = getPageNodeId(patch.sourcePage);
	const targetId = getPageNodeId(patch.targetPage);
	const sourceRef =
		queryNodes(r.tree.root, `#${sourceId}`)[0] ??
		queryNodes(r.tree.root, `[data-resume-page="${patch.sourcePage}"]`)[0] ??
		queryNodes(r.tree.root, RESUME_SELECTORS.resume)[0];

	if (!sourceRef) {
		throw new Error(`No source page found for page ${patch.sourcePage}.`);
	}

	const targetRef =
		queryNodes(r.tree.root, `#${targetId}`)[0] ??
		queryNodes(r.tree.root, `[data-resume-page="${patch.targetPage}"]`)[0];

	const clonedPage = cloneJson(sourceRef.node);
	setNodeAttribute(clonedPage, "id", targetId);
	setNodeAttribute(clonedPage, "data-resume-page", patch.targetPage);
	if (patch.targetLanguage) {
		setNodeAttribute(clonedPage, "lang", patch.targetLanguage);
	}

	if (targetRef?.parent) {
		targetRef.parent.children![targetRef.index] = clonedPage;
	} else if (sourceRef.parent) {
		sourceRef.parent.children!.splice(sourceRef.index + 1, 0, clonedPage);
	} else {
		throw new Error("Unable to place cloned page.");
	}

	const actionWord = targetRef ? "Replaced" : "Cloned";

	return {
		ok: true,
		action: PatchAction.ClonePage,
		message: `${actionWord} resume page ${patch.sourcePage} to page ${patch.targetPage}.`,
	};
}

function getPageNodeId(page: string): string {
	const numeric = String(page).trim();
	return `page-${numeric.padStart(2, "0")}`;
}
