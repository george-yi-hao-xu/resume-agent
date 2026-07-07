import type { MutableNode, NodeRef } from "./patcher.types";

// Deep-clone JSON-safe patch inputs before mutating them.
export function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

// Sort tree paths from left to right, with shorter prefixes first when equal.
export function comparePaths(left: number[], right: number[]): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		if (left[index] !== right[index]) {
			return left[index] - right[index];
		}
	}
	return left.length - right.length;
}


// Find every node matching a selector anywhere in the tree.
export function queryNodes(root: MutableNode, selector: string): NodeRef[] {
	const refs: NodeRef[] = [];
	visitNode(root, [], null, -1, [], refs, selector);
	return refs;
}

// Traverse the tree depth-first and collect selector matches with path metadata.
export function visitNode(
	node: MutableNode,
	ancestors: MutableNode[],
	parent: MutableNode | null,
	index: number,
	path: number[],
	refs: NodeRef[],
	selector: string,
): void {
	if (node.type === "element" && matchesSelector(node, ancestors, selector)) {
		refs.push({ node, parent, index, path, ancestors });
	}

	const children = node.children ?? [];
	for (let childIndex = 0; childIndex < children.length; childIndex += 1) {
		visitNode(
			children[childIndex],
			node.type === "element" ? [...ancestors, node] : ancestors,
			node,
			childIndex,
			[...path, childIndex],
			refs,
			selector,
		);
	}
}

// Check whether a node matches a comma-separated selector list.
export function matchesSelector(
	node: MutableNode,
	ancestors: MutableNode[],
	selector: string,
): boolean {
	const groups = selector
		.split(",")
		.map((group) => group.trim())
		.filter(Boolean);
	if (!groups.length) {
		return false;
	}

	return groups.some((group) => matchesSelectorGroup(node, ancestors, group));
}

function matchesSelectorGroup(
	node: MutableNode,
	ancestors: MutableNode[],
	selector: string,
): boolean {
	// Match the rightmost token first, then walk upward to satisfy descendant selectors.
	const tokens = selector.trim().split(/\s+/).filter(Boolean);
	if (!tokens.length) {
		return false;
	}

	if (!matchesSimpleSelector(node, tokens[tokens.length - 1])) {
		return false;
	}

	let ancestorIndex = ancestors.length - 1;
	for (let tokenIndex = tokens.length - 2; tokenIndex >= 0; tokenIndex -= 1) {
		let matched = false;
		for (
			let searchIndex = ancestorIndex;
			searchIndex >= 0;
			searchIndex -= 1
		) {
			if ( matchesSimpleSelector( ancestors[searchIndex], tokens[tokenIndex],)) {
				ancestorIndex = searchIndex - 1;
				matched = true;
				break;
			}
		}
		if (!matched) {
			return false;
		}
	}

	return true;
}

function matchesSimpleSelector(node: MutableNode, token: string): boolean {
	if (token === "*") {
		return true;
	}
	if (node.type !== "element" || !node.tagName) {
		return false;
	}

	const selector = token.trim();
	const tagName = selector.match(/^[a-zA-Z0-9_-]+/)?.[0];
	if (tagName && node.tagName.toLowerCase() !== tagName.toLowerCase()) {
		return false;
	}

	const nodeAttributes = node.attributes ?? {};
	const id = selector.match(/#([a-zA-Z0-9_-]+)/)?.[1];
	if (id && nodeAttributes.id !== id) {
		return false;
	}

	const nodeClasses = (nodeAttributes.class ?? "").split(/\s+/).filter(Boolean);
	for (const className of selector.match(/\.([a-zA-Z0-9_-]+)/g) ?? []) {
		if (!nodeClasses.includes(className.slice(1))) {
			return false;
		}
	}

	for (const match of selector.matchAll(/\[([^\]=\s]+)(?:=(["']?)(.*?)\2)?\]/g)) {
		const name = match[1];
		if (!(name in nodeAttributes)) {
			return false;
		}
		if (match[3] !== undefined && nodeAttributes[name] !== match[3]) {
			return false;
		}
	}

	return true;
}
