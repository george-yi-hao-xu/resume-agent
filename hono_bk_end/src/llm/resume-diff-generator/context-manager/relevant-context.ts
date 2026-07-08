import type { Resume, v_dom_node } from "@repo/schema";
import type { DiffIntentClassification } from "../intent-classifier.js";

type NodeCandidate = {
	path: string;
	node: v_dom_node;
};

export function build_relevant_nodes(
	resume: Resume | null,
	intentClassification: DiffIntentClassification,
	_instruction: string,
): v_dom_node[] {
	if (!resume) {
		return [];
	}

	const candidates = collect_relevant_nodes(
		resume.tree.root,
		"/tree/root",
		intentClassification.intent,
	);

	// For page clone/translate we need the full source page subtree,
	// not a token-filtered slice.
	if (intentClassification.intent === "page_clone_translate") {
		return clone_nodes(candidates);
	}

	const tokens = search_tokens(_instruction);
	const matches = candidates.filter(
		(item) =>
			item.node.tagName !== "main" && node_matches(item.node, tokens),
	);
	if (matches.length) {
		return clone_nodes(remove_nested_matches(matches));
	}

	return clone_nodes(candidates);
}

function collect_relevant_nodes(
	root: v_dom_node,
	rootPath: string,
	intent: DiffIntentClassification["intent"],
): NodeCandidate[] {
	const result: NodeCandidate[] = [];

	function walk(node: v_dom_node, path: string): void {
		if (node.type !== "element") return;

		const tag = node.tagName ?? "";
		const isPage = tag === "main";
		const isSection = tag === "section" || tag === "header";
		const isContentElement = [
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"p",
			"li",
			"span",
			"a",
			"ul",
			"ol",
		].includes(tag);
		const isNamedDiv =
			tag === "div" && (node.attributes?.class || node.attributes?.id);

		if (isPage) {
			result.push({ path: node.wd || path, node });
		}

		const includeForVisual =
			intent === "visual" && (isSection || isNamedDiv);
		const includeForClone =
			intent === "page_clone_translate" &&
			(isSection || isContentElement || isNamedDiv);
		const includeForContent =
			(intent === "content" || intent === "mixed") &&
			(isSection || isContentElement || isNamedDiv);

		if (includeForVisual || includeForClone || includeForContent) {
			result.push({ path: node.wd || path, node });
		}

		(node.children ?? []).forEach((child, index) => {
			walk(child, `${path}/children/${index}`);
		});
	}

	walk(root, rootPath);
	return dedupe_nodes(result);
}

function search_tokens(instruction: string): string[] {
	const tokens = new Set(
		instruction
			.toLowerCase()
			.split(/[^a-z0-9\u4e00-\u9fa5]+/u)
			.map((item) => item.trim())
			.filter((item) => item.length >= 2),
	);

	if (/(summary|总结|简介|概述)/i.test(instruction)) {
		add_tokens(tokens, "summary", "summary-section", "summary-text");
	}
	if (/(experience|经历|工作|职位|job|title|标题)/i.test(instruction)) {
		add_tokens(
			tokens,
			"experience",
			"experience-section",
			"job-title",
			"resume-title",
		);
	}
	if (/(skill|skills|技能)/i.test(instruction)) {
		add_tokens(tokens, "skills", "skills-section", "skills-list");
	}
	if (/(project|projects|项目)/i.test(instruction)) {
		add_tokens(tokens, "projects", "projects-section", "project-list");
	}
	if (/(name|姓名|名字)/i.test(instruction)) {
		add_tokens(tokens, "resume-name", "name");
	}
	if (
		/(contact|email|phone|location|邮箱|电话|地址|联系方式)/i.test(
			instruction,
		)
	) {
		add_tokens(
			tokens,
			"contact",
			"contact-list",
			"contact-email",
			"contact-phone",
		);
	}

	return Array.from(tokens);
}

function add_tokens(tokens: Set<string>, ...items: string[]): void {
	items.forEach((item) => tokens.add(item));
}

function node_matches(node: v_dom_node, tokens: string[]): boolean {
	if (!tokens.length) {
		return false;
	}
	const haystack = node_search_text(node);
	return tokens.some((token) => haystack.includes(token));
}

function node_search_text(node: v_dom_node): string {
	const parts: string[] = [];
	const walk = (current: v_dom_node): void => {
		parts.push(current.type, current.tagName ?? "");
		if (current.value) {
			parts.push(current.value);
		}
		const attrs = current.attributes ?? {};
		parts.push(attrs.class ?? "", attrs.id ?? "", attrs.name ?? "");
		(current.children ?? []).forEach(walk);
	};
	walk(node);
	return parts.join(" ").toLowerCase();
}

function clone_nodes(items: NodeCandidate[]): v_dom_node[] {
	return items.map((item) => {
		const clone = JSON.parse(JSON.stringify(item.node)) as v_dom_node;
		ensure_wd(clone, item.path);
		return clone;
	});
}

function remove_nested_matches(items: NodeCandidate[]): NodeCandidate[] {
	return items.filter((item) => {
		return !items.some((other) => {
			return (
				other.path !== item.path &&
				item.path.startsWith(`${other.path}/children/`)
			);
		});
	});
}

function ensure_wd(node: v_dom_node, wd: string): void {
	node.wd = node.wd || wd;
	(node.children ?? []).forEach((child, index) => {
		ensure_wd(child, `${node.wd}/children/${index}`);
	});
}

function dedupe_nodes(items: NodeCandidate[]): NodeCandidate[] {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.path)) {
			return false;
		}
		seen.add(item.path);
		return true;
	});
}
