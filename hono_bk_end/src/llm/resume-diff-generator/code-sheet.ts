import type {
	ResumeDiffRequest,
	Resume,
	v_dom_node,
	v_style_item,
} from "@repo/schema";

export function readResumeFromRequest(
	request: ResumeDiffRequest,
): Resume | null {
	const source = request.resumeDom ?? request.resumeStructure ?? "";
	if (!source.trim()) {
		return null;
	}

	try {
		const parsed = JSON.parse(source) as Resume;
		if (
			parsed &&
			typeof parsed === "object" &&
			Array.isArray(parsed.styles) &&
			parsed.tree?.root
		) {
			return parsed;
		}
	} catch {
		return null;
	}

	return null;
}

export function buildResumeJsonFile(resume: Resume | null): string {
	if (!resume) {
		return "No parseable resume JSON was provided.";
	}

	return JSON.stringify(resume);
}

export function buildResumePathIndex(resume: Resume | null): string {
	if (!resume) {
		return "No parseable resume JSON was provided.";
	}

	const lines: string[] = [];
	lines.push("Page/container paths:");
	collectPagePaths(resume.tree.root, "/tree/root", lines);
	lines.push("Text value paths:");
	collectTextPaths(resume.tree.root, "/tree/root", lines);
	lines.push("Classed node paths:");
	collectClassedNodePaths(resume.tree.root, "/tree/root", lines);
	lines.push("Style attribute paths:");
	collectStylePaths(resume.styles, lines);
	return lines.join("\n");
}

function collectPagePaths(
	node: v_dom_node,
	fallbackWd: string,
	lines: string[],
): void {
	const wd = node.wd || fallbackWd;
	if (node.type === "element" && node.tagName === "main") {
		const id = node.attributes?.id;
		const className = node.attributes?.class;
		lines.push(
			`${wd} <main id=${JSON.stringify(id ?? "")} class=${JSON.stringify(className ?? "")}>`,
		);
	}

	(node.children ?? []).forEach((child, index) => {
		collectPagePaths(child, `${wd}/children/${index}`, lines);
	});
}

function collectTextPaths(
	node: v_dom_node,
	fallbackWd: string,
	lines: string[],
): void {
	const wd = node.wd || fallbackWd;
	if (node.type === "text") {
		lines.push(`${wd}/value = ${JSON.stringify(node.value ?? "")}`);
		return;
	}

	(node.children ?? []).forEach((child, index) => {
		collectTextPaths(child, `${wd}/children/${index}`, lines);
	});
}

function collectClassedNodePaths(
	node: v_dom_node,
	fallbackWd: string,
	lines: string[],
): void {
	const wd = node.wd || fallbackWd;
	if (node.type === "element") {
		const className = node.attributes?.class;
		if (className) {
			lines.push(
				`${wd} <${node.tagName ?? "element"} class=${JSON.stringify(className)}>`,
			);
		}
	}

	(node.children ?? []).forEach((child, index) => {
		collectClassedNodePaths(child, `${wd}/children/${index}`, lines);
	});
}

function collectStylePaths(styles: v_style_item[], lines: string[]): void {
	styles.forEach((style, index) => {
		if ("selector" in style) {
			lines.push(
				`/styles/${index}/attributes selector=${JSON.stringify(style.selector)} current=${JSON.stringify(style.attributes)}`,
			);
			return;
		}
		if ("rules" in style) {
			style.rules.forEach((rule, ruleIndex) => {
				lines.push(
					`/styles/${index}/rules/${ruleIndex}/attributes selector=${JSON.stringify(rule.selector)} current=${JSON.stringify(rule.attributes)}`,
				);
			});
			return;
		}
		if ("atRule" in style) {
			lines.push(
				`/styles/${index}/attributes atRule=${JSON.stringify(style.atRule)} current=${JSON.stringify(style.attributes)}`,
			);
		}
	});
}
