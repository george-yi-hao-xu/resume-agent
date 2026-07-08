// text_patcher.ts
import type { Resume } from "@repo/schema/src/resume.types";
import type { PatchResult } from "../../types";
import { PatchAction } from "../../types";
import { queryNodes } from "./utils";

export function textPatcher(
	r: Resume,
	selector: string,
	from: string,
	to: string,
): PatchResult {
	const refs = queryNodes(r.tree.root, selector);
	if (!refs.length) {
		return {
			ok: false,
			action: PatchAction.UpdateText,
			message: `No elements found for selector: ${selector}`,
		};
	}

	for (const ref of refs) {
		// double check
		if (ref.node.value !== from) continue;

		ref.node.children = [
			{
				type: "text",
				value: to,
			},
		];
		delete ref.node.value;
	}

	return {
		ok: true,
		action: PatchAction.UpdateText,
		message: `Updated text on ${refs.length} element${refs.length === 1 ? "" : "s"}.`,
	};
}
