import { PatchAction, type PatchResult, type UiPatch } from "../../types";
import type { Resume } from "@repo/schema/src/resume.types";
import { queryNodes } from "./utils";

type TranslatePagePatch = Extract<UiPatch, { action: PatchAction.TranslatePage }>;

export function translatePagePatcher(
	r: Resume,
	patch: TranslatePagePatch,
): PatchResult {
	const pageRef =
		queryNodes(r.tree.root, `#${getPageNodeId(patch.page)}`)[0] ??
		queryNodes(r.tree.root, `[data-resume-page="${patch.page}"]`)[0];

	if (!pageRef) {
		throw new Error(`No page found for translation target ${patch.page}.`);
	}

	pageRef.node.attributes ??= {};
	pageRef.node.attributes.lang = patch.targetLanguage;

	let applied = 0;
	let skipped = 0;

	for (const update of patch.textUpdates ?? []) {
		const refs = queryNodes(pageRef.node, update.selector);
		if (!refs.length) {
			skipped += 1;
			continue;
		}

		for (const ref of refs) {
			ref.node.children = [{ type: "text", value: update.text }];
			delete ref.node.value;
		}
		applied += 1;
	}

	let message = `Translated page ${patch.page} to ${patch.targetLanguage} with ${applied} text update${applied === 1 ? "" : "s"}.`;
	if (skipped > 0) {
		message = `${message.slice(0, -1)}, skipped ${skipped} missing selector${skipped === 1 ? "" : "s"}.`;
	}

	return {
		ok: applied > 0,
		action: PatchAction.TranslatePage,
		message,
	};
}

function getPageNodeId(page: string): string {
	const numeric = String(page).trim();
	return `page-${numeric.padStart(2, "0")}`;
}
