// css_patcher.ts
import { Resume, v_style_node } from "@repo/schema/src/resume.types";
import { PatchAction } from "../../types";
import type { PatchResult } from "../../types";

export function cssPatcher(
	r: Resume,
	targetSelector: string,
	styleAttrs: Record<string, string>,
): PatchResult {
	const normalizedTargetSelector = targetSelector.trim();
	const normalizedStyles: Record<string, string> = {};
	for (const [name, value] of Object.entries(styleAttrs)) {
		normalizedStyles[toCssPropertyName(name)] = value;
	}

	let updatedRules = 0;
	let matched = false;

	// Walk the stylesheet tree and update every rule that targets the selector.
	walkStyleItems(r.styles, (item) => {
		if (
			!item.selector
				.split(",")
				.map((candidate) => candidate.trim())
				.includes(normalizedTargetSelector)
		) {
			return;
		}

		item.attributes = {
			...item.attributes,
			...normalizedStyles,
		};
		updatedRules += 1;
		matched = true;
	});

	if (!matched) {
		r.styles.push({
			selector: targetSelector,
			attributes: normalizedStyles,
		});
		updatedRules = 1;
	}

	return {
		ok: true,
		action: PatchAction.UpdateCss,
		message: `Updated CSS on ${updatedRules} rule${updatedRules === 1 ? "" : "s"}.`,
	};
}

function toCssPropertyName(name: string): string {
	if (name.startsWith("--")) {
		return name;
	}

	return name.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function walkStyleItems(
	items: Resume["styles"],
	change: (n: v_style_node) => void,
): void {
	for (const item of items) {
		if ("selector" in item && "attributes" in item) {
			change(item);
			continue;
		}

		if ("media" in item && "rules" in item) {
			walkStyleItems(item.rules, change);
		}
	}
}
