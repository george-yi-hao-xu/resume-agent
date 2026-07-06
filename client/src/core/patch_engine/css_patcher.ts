// css_patcher.ts
import { Resume } from "../../resume.types";
import { PatchAction } from "../../types";
import type { PatchResult } from "../../types";

export function cssPatcher(
	r: Resume,
	selector: string,
	styles: Record<string, string>,
): PatchResult {
	const normalizedStyles: Record<string, string> = {};
	for (const [name, value] of Object.entries(styles)) {
		normalizedStyles[toCssPropertyName(name)] = value;
	}

	let updatedRules = 0;
	let matched = false;

	for (const item of r.styles) {
		if (
			"selector" in item &&
			selectorMatchesSelectorList(item.selector, selector)
		) {
			item.attributes = {
				...item.attributes,
				...normalizedStyles,
			};
			updatedRules += 1;
			matched = true;
			continue;
		}

		if ("media" in item) {
			for (const rule of item.rules) {
				if (selectorMatchesSelectorList(rule.selector, selector)) {
					rule.attributes = {
						...rule.attributes,
						...normalizedStyles,
					};
					updatedRules += 1;
					matched = true;
				}
			}
		}
	}

	if (!matched) {
		r.styles.push({
			selector,
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

function selectorMatchesSelectorList(
	selectorList: string,
	selector: string,
): boolean {
	return selectorList
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
		.includes(selector.trim());
}
