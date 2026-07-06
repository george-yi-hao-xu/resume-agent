import type { Resume } from "../../resume.types";
import { PatchAction, type PatchResult, type UiPatch } from "../../types";
import type { MutableNode, NodeRef } from "./patcher.types";
import { queryNodes } from "./utils";

const BLOCKED_INSERT_TAGS = new Set(["script", "style", "iframe", "object", "embed"]);

export function insertHtmlPatcher(
	r: Resume,
	patch: Extract<UiPatch, { action: PatchAction.InsertHtml }>,
): PatchResult {
	const parentRefs = queryNodes(r.tree.root, patch.parent);
	if (!parentRefs.length) {
		return {
			ok: false,
			action: PatchAction.InsertHtml,
			message: `No parent found for selector: ${patch.parent}.`,
		};
	}

	const insertNodes = parseSanitizedHtmlFragment(patch.html);
	if (!insertNodes.length) {
		return {
			ok: true,
			action: PatchAction.InsertHtml,
			message: `Inserted HTML into ${patch.parent}.`,
		};
	}

	const position = patch.position ?? "beforeend";
	for (const parentRef of parentRefs) {
		const clonedNodes = cloneJson(insertNodes);
		insertNodesIntoParent(parentRef, clonedNodes, position);
	}

	return {
		ok: true,
		action: PatchAction.InsertHtml,
		message: `Inserted HTML into ${patch.parent}.`,
	};
}

function insertNodesIntoParent(
	parentRef: NodeRef,
	nodes: MutableNode[],
	position: string,
): void {
	const parent = parentRef.node;
	parent.children ??= [];

	if (position === "beforeend") {
		parent.children.push(...nodes);
		return;
	}

	if (position === "afterbegin") {
		parent.children.unshift(...nodes);
		return;
	}

	if (!parentRef.parent) {
		throw new Error("No insertion context for selector.");
	}

	parentRef.parent.children ??= [];
	const parentChildren = parentRef.parent.children;
	const insertIndex =
		position === "afterend" ? parentRef.index + 1 : parentRef.index;
	parentChildren.splice(insertIndex, 0, ...nodes);
}

function parseSanitizedHtmlFragment(html: string): MutableNode[] {
	const template = document.createElement("template");
	template.innerHTML = html;
	const nodes: MutableNode[] = [];

	for (const child of Array.from(template.content.childNodes)) {
		const converted = convertDomNode(child);
		if (converted) {
			nodes.push(...converted);
		}
	}

	return nodes;
}

function convertDomNode(node: ChildNode): MutableNode[] {
	if (node.nodeType === Node.TEXT_NODE) {
		const value = node.textContent ?? "";
		return value ? [{ type: "text", value }] : [];
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return [];
	}

	const element = node as Element;
	const tagName = element.tagName.toLowerCase();
	if (BLOCKED_INSERT_TAGS.has(tagName)) {
		return [];
	}

	const attributes: Record<string, string> = {};
	for (const attr of Array.from(element.attributes)) {
		const name = attr.name;
		const value = attr.value;
		if (name.toLowerCase().startsWith("on")) {
			continue;
		}
		if (/^\s*javascript:/i.test(value)) {
			continue;
		}
		attributes[name] = value;
	}

	const children: MutableNode[] = [];
	for (const child of Array.from(element.childNodes)) {
		const convertedChildren = convertDomNode(child);
		if (convertedChildren.length) {
			children.push(...convertedChildren);
		}
	}

	return [
		{
			type: "element",
			tagName,
			attributes,
			children,
		},
	];
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
