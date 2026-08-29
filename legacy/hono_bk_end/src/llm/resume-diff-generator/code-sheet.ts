import type {
	Resume,
	ResumeDiffRequest,
	v_dom_node,
	v_style_item,
} from "@repo/schema";

export function read_resume_from_request(
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

export function build_resume_json_file(resume: Resume | null): string {
	if (!resume) {
		return "No parseable resume JSON was provided.";
	}

	return JSON.stringify(resume);
}

export function build_resume_path_index(resume: Resume | null): string {
	if (!resume) {
		return "No parseable resume JSON was provided.";
	}

	const lines: string[] = [];
	lines.push("Page/container paths:");
	collect_page_paths(resume.tree.root, "/tree/root", lines);
	lines.push("Text value paths:");
	collect_text_paths(resume.tree.root, "/tree/root", lines);
	lines.push("Classed node paths:");
	collect_classed_node_paths(resume.tree.root, "/tree/root", lines);
	lines.push("Style attribute paths:");
	collect_style_paths(resume.styles, lines);
	return lines.join("\n");
}

function collect_page_paths(
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
		collect_page_paths(child, `${wd}/children/${index}`, lines);
	});
}

function collect_text_paths(
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
		collect_text_paths(child, `${wd}/children/${index}`, lines);
	});
}

function collect_classed_node_paths(
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
		collect_classed_node_paths(child, `${wd}/children/${index}`, lines);
	});
}

function collect_style_paths(styles: v_style_item[], lines: string[]): void {
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
