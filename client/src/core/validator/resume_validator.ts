// resume_validator.ts

import type { Resume } from '../../resume.types'
import { isRecord } from '../utils';

export function isResume(v: unknown) {
    return resumeValidator(v)
}

function resumeValidator(value: unknown): value is Resume {
	if (!isRecord(value)) {
		return false;
	}

	if (!Array.isArray(value.styles) || !isResumeTree(value.tree)) {
		return false;
	}

	return value.styles.every(isStyleItem);
}


function isResumeTree(value: unknown): value is Resume["tree"] {
	return (
		isRecord(value) &&
		value.doctype === "html" &&
		isDomNode(value.root)
	);
}

function isStyleItem(value: unknown): boolean {
	if (!isRecord(value)) {
		return false;
	}

	if (
		"selector" in value &&
		"attributes" in value &&
		typeof value.selector === "string" &&
		isStringRecord(value.attributes)
	) {
		return true;
	}

	if (
		"media" in value &&
		"rules" in value &&
		typeof value.media === "string" &&
		Array.isArray(value.rules) &&
		value.rules.every(isStyleNode)
	) {
		return true;
	}

	if (
		"atRule" in value &&
		"attributes" in value &&
		typeof value.atRule === "string" &&
		isStringRecord(value.attributes)
	) {
		return true;
	}

	return false;
}

function isStyleNode(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.selector === "string" &&
		isStringRecord(value.attributes)
	);
}

function isDomNode(value: unknown): boolean {
	if (!isRecord(value) || typeof value.type !== "string") {
		return false;
	}

	if (value.tagName !== undefined && typeof value.tagName !== "string") {
		return false;
	}

	if (value.value !== undefined && typeof value.value !== "string") {
		return false;
	}

	if (
		value.attributes !== undefined &&
		(!isStringRecord(value.attributes) ||
			!Object.values(value.attributes).every((attrValue) =>
				typeof attrValue === "string",
			))
	) {
		return false;
	}

	if (
		value.children !== undefined &&
		(!Array.isArray(value.children) ||
			!value.children.every(isDomNode))
	) {
		return false;
	}

	if (value.type !== "text" && typeof value.tagName !== "string") {
		return false;
	}

	return true;
}



function isStringRecord(value: unknown): value is Record<string, string> {
	return (
		isRecord(value) &&
		Object.values(value).every((item) => typeof item === "string")
	);
}
