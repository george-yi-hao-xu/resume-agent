import type { Resume, v_dom_node } from "@repo/schema/src/resume.types";

export function withResumeWd(resume: Resume): Resume {
	const next = clone(resume);
	maintainResumeWd(next);
	return next;
}

export function maintainResumeWd(resume: Resume): void {
	resume.wd = "/";
	resume.tree.wd = "/tree";
	maintainNodeWd(resume.tree.root, "/tree/root");
}

function maintainNodeWd(node: v_dom_node, wd: string): void {
	node.wd = wd;

	(node.children ?? []).forEach((child, index) => {
		maintainNodeWd(child, `${wd}/children/${index}`);
	});
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
