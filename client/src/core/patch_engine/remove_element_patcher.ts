import type { Resume } from "@repo/schema/src/resume.types";
import { PatchAction, type PatchResult } from "../../types";
import { comparePaths, queryNodes } from "./utils";

export function removeElementPatcher(r: Resume, selector: string): PatchResult {
	const refs = queryNodes(r.tree.root, selector);
	if (!refs.length) {
		return {
			ok: false,
			action: PatchAction.RemoveElement,
			message: `No elements found for selector: ${selector}`,
		};
	}

	const removable = refs
		.filter((ref) => ref.parent)
		.sort((left, right) => comparePaths(right.path, left.path));

	for (const ref of removable) {
		ref.parent!.children?.splice(ref.index, 1);
	}

	return {
		ok: true,
		action: PatchAction.RemoveElement,
		message: `Removed ${removable.length} element${removable.length === 1 ? "" : "s"}.`,
	};
}
