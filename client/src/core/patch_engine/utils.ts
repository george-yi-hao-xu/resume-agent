import type { MutableNode, NodeRef } from "./patcher.types";

export function queryNodes(root: MutableNode, selector: string): NodeRef[] {
	const refs: NodeRef[] = [];
	visitNode(root, [], null, -1, [], refs, selector);
	return refs;
}

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
			if (
				matchesSimpleSelector(
					ancestors[searchIndex],
					tokens[tokenIndex],
				)
			) {
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

	let index = 0;
	const selector = token.trim();
	let tagName = "";
	const classNames: string[] = [];
	const attributes: Array<{ name: string; value?: string }> = [];
	let id: string | undefined;

	while (index < selector.length && /[a-zA-Z0-9_-]/.test(selector[index])) {
		tagName += selector[index];
		index += 1;
	}

	while (index < selector.length) {
		const char = selector[index];
		if (char === "#") {
			index += 1;
			let value = "";
			while (
				index < selector.length &&
				/[a-zA-Z0-9_-]/.test(selector[index])
			) {
				value += selector[index];
				index += 1;
			}
			id = value;
			continue;
		}

		if (char === ".") {
			index += 1;
			let value = "";
			while (
				index < selector.length &&
				/[a-zA-Z0-9_-]/.test(selector[index])
			) {
				value += selector[index];
				index += 1;
			}
			if (value) {
				classNames.push(value);
			}
			continue;
		}

		if (char === "[") {
			index += 1;
			let content = "";
			while (index < selector.length && selector[index] !== "]") {
				content += selector[index];
				index += 1;
			}
			index += 1;
			const [rawName, rawValue] = content.split("=");
			const name = rawName.trim();
			const value = rawValue?.trim().replace(/^["']|["']$/g, "");
			if (name) {
				attributes.push({ name, value });
			}
			continue;
		}

		index += 1;
	}

	if (tagName && node.tagName.toLowerCase() !== tagName.toLowerCase()) {
		return false;
	}

	const nodeAttributes = node.attributes ?? {};
	if (id && nodeAttributes.id !== id) {
		return false;
	}

	if (classNames.length) {
		const nodeClasses = (nodeAttributes.class ?? "")
			.split(/\s+/)
			.filter(Boolean);
		for (const className of classNames) {
			if (!nodeClasses.includes(className)) {
				return false;
			}
		}
	}

	for (const attribute of attributes) {
		if (!(attribute.name in nodeAttributes)) {
			return false;
		}
		if (
			attribute.value !== undefined &&
			nodeAttributes[attribute.name] !== attribute.value
		) {
			return false;
		}
	}

	return true;
}

