import { type Resume, type PatchResult, PatchAction } from "@repo/schema";

import { queryNodes } from "./utils";
export function updateElementAttrPatcher(
	r: Resume,
	selector: string,
	attr: string,
	value: string,
): PatchResult {
	const refs = queryNodes(r.tree.root, selector);
	if (!refs.length) {
		return {
			ok: false,
			action: PatchAction.UpdateElementAttr,
			message: `No elements found for selector: ${selector}`,
		};
	}

	for (const ref of refs) {
		ref.node.attributes ??= {};
		if (!value) {
			delete ref.node.attributes[attr];
			continue;
		}

		ref.node.attributes[attr] = value;
	}

	return {
		ok: true,
		action: PatchAction.UpdateElementAttr,
		message: `Updated attribute ${attr} on ${refs.length} element${refs.length === 1 ? "" : "s"}.`,
	};
}