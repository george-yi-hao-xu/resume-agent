import { type Resume, type PatchResult, PatchAction } from "@repo/schema";

import { queryNodes } from "./utils";
export function updateElementAttrPatcher(
	r: Resume,
	selector: string,
	attributes: Record<string, string>,
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
		for (const [attr, value] of Object.entries(attributes)) {
			if (!value) {
				delete ref.node.attributes[attr];
				continue;
			}

			ref.node.attributes[attr] = value;
		}
	}

	const keys = Object.keys(attributes).join(", ");

	return {
		ok: true,
		action: PatchAction.UpdateElementAttr,
		message: `Updated attribute${Object.keys(attributes).length === 1 ? "" : "s"} ${keys} on ${refs.length} element${refs.length === 1 ? "" : "s"}.`,
	};
}
