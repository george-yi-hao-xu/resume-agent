// text_patcher.ts
import type { Resume } from "../../resume.types";
import type { PatchResult } from "../../types";
import { PatchAction } from "../../types";
import { queryNodes } from "./utils";

export function textPatcher(
	r: Resume,
	selector: string,
	text: string,
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
		ref.node.children = [
			{
				type: "text",
				value: text,
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
