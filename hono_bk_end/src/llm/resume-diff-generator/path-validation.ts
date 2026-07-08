import type { Resume, ResumeDiffOp, v_dom_node } from "@repo/schema";

export function validate_diff_paths_for_resume(
	diffs: ResumeDiffOp[],
	resume: Resume | null,
): void {
	if (!resume) {
		return;
	}

	const validPaths = collect_valid_wd_paths(resume.tree.root, "/tree/root");
	for (const diff of diffs) {
		if (must_target_existing_path(diff.op)) {
			validate_existing_wd_path(diff.path, validPaths, diff.op);
		}
		if ("from" in diff) {
			validate_existing_wd_path(diff.from, validPaths, `${diff.op}.from`);
		}
	}
}

function must_target_existing_path(op: ResumeDiffOp["op"]): boolean {
	return op === "replace" || op === "remove" || op === "test";
}

function validate_existing_wd_path(
	path: string,
	validPaths: Set<string>,
	op: string,
): void {
	if (!validPaths.has(path)) {
		throw new Error(
			`LLM returned invalid ${op} path not present in valid resume wd paths: ${path}`,
		);
	}
}

function collect_valid_wd_paths(
	node: v_dom_node,
	fallbackWd: string,
	paths = new Set<string>(),
): Set<string> {
	const wd = node.wd || fallbackWd;
	paths.add(wd);
	if (node.type === "text") {
		paths.add(`${wd}/value`);
	}

	(node.children ?? []).forEach((child, index) => {
		collect_valid_wd_paths(child, `${wd}/children/${index}`, paths);
	});
	return paths;
}
