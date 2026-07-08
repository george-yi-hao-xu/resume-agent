import type {
	PatchResult,
	ResumeDiffOp,
	ResumeJsonPatchValue,
} from "@repo/schema";
import type { Resume } from "@repo/schema/src/resume.types";
import { PatchAction } from "../../types";
import { isResume } from "../validator/resume_validator";

export type ResumeVTreeDiffResult = {
	new: Resume;
	results: PatchResult[];
	changed: boolean;
};

type JsonContainer = Record<string, unknown> | unknown[];

type TargetRef = {
	target: unknown;
	parent: JsonContainer;
};

const BLOCKED_INSERT_TAGS = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
]);

export function applyDiff(
	resume: Resume,
	diffs: ResumeDiffOp[],
): ResumeVTreeDiffResult {
	const before = clone(resume);
	const next = clone(resume);

	if (!Array.isArray(diffs)) {
		return {
			new: before,
			results: [fail("Diff payload must be an array.")],
			changed: false,
		};
	}

	const results: PatchResult[] = [];
	for (const diff of diffs) {
		results.push(applyOneDiff(next, diff));
	}

	if (!isResume(next)) {
		results.push(fail("Diff produced an invalid resume object."));
	}

	const hasFailure = results.some((result) => !result.ok);
	if (hasFailure) {
		console.log("-some failed: ", results);
		return {
			new: before,
			results,
			changed: false,
		};
	}

	console.log("-all success: ", results);
	return {
		new: next,
		results,
		changed: JSON.stringify(before) !== JSON.stringify(next),
	};
}

// Dispatch one JSON Patch-style operation and convert thrown validation errors
// into per-op results so the caller can show useful feedback.
function applyOneDiff(resume: Resume, diff: ResumeDiffOp): PatchResult {
	try {
		switch (diff.op) {
			case "add":
				guard(diff.path, diff.value);
				add(resume, diff.path, clone(diff.value));
				return ok(`Added value at ${diff.path}.`, diff.op);
			case "remove":
				rm(resume, diff.path);
				return ok(`Removed value at ${diff.path}.`, diff.op);
			case "replace":
				guard(diff.path, diff.value);
				return ok(
					`Replaced value at ${rp(resume, diff.path, clone(diff.value))}.`, diff.op
				);
			case "move": {
				const value = clone(read(resume, diff.from));
				rm(resume, diff.from);
				add(resume, diff.path, value);
				return ok(`Moved value from ${diff.from} to ${diff.path}.`, diff.op);
			}
			case "copy": {
				const value = clone(read(resume, diff.from));
				guard(diff.path, value);
				add(resume, diff.path, value);
				return ok(`Copied value from ${diff.from} to ${diff.path}.`, diff.op);
			}
			case "test":
				if (!jsonEqual(read(resume, diff.path), diff.value)) {
					return fail(`Test failed at ${diff.path}.`, diff.op);
				}
				return ok(`Test passed at ${diff.path}.`, diff.op);
			default:
				return fail("Unknown diff operation ignored.");
		}
	} catch (error) {
		return fail(error instanceof Error ? error.message : "Diff failed.");
	} finally {
		console.log("- Finish one diff", diff.op);
	}
}

// Implements JSON Patch "add": insert into arrays, append with "-", or assign
// object properties. Array insertion allows index === length.
function add(root: Resume, path: string, value: unknown): void {
	const ref = search(root, path, { allowAppend: true });
	const token = lastToken(path);
	if (Array.isArray(ref.parent)) {
		if (token === "-") {
			ref.parent.push(value);
			return;
		}
		const index = guardArrIdx(ref.parent, token, {
			allowEnd: true,
		});
		ref.parent.splice(index, 0, value);
		return;
	}

	ref.parent[token] = value;
}

// Implements JSON Patch "remove". It mutates in place and intentionally returns
// nothing; "move" reads the value before removing so it can clone it first.
function rm(root: Resume, path: string): void {
	const ref = search(root, path);
	const token = lastToken(path);
	if (Array.isArray(ref.parent)) {
		const index = guardArrIdx(ref.parent, token);
		ref.parent.splice(index, 1);
		return;
	}

	if (!(token in ref.parent)) {
		throw new Error(`Unknown path: ${path}`);
	}
	delete ref.parent[token];
}

// Implements JSON Patch "replace". Unlike add, the target must already exist.
function rp(root: Resume, path: string, value: unknown): string {
	const ref = search(root, path);
	const nodePath = apply(ref.target, value, path);

	if (nodePath) {
		return nodePath;
	}

	set(ref, path, value);
	return path;
}

// Reads the value at a JSON Pointer path. Used by copy, move, and test.
function read(root: Resume, path: string): unknown {
	if (path === "") {
		return root;
	}

	return search(root, path).target;
}

// Resolves a JSON Pointer to the editable parent container and final key. This
// keeps root replacement/removal disabled and centralizes append-token checks.
function search(
	root: Resume,
	path: string,
	options: { allowAppend?: boolean } = {},
): TargetRef {
	// guard
	if (!path.startsWith("/")) {
		throw new Error(`Invalid JSON pointer path: ${path}`);
	}
	if (path === "") {
		throw new Error("Root edits are not supported.");
	}

	const pathTokens = ptr(path);
	if (!pathTokens.length) {
		throw new Error("Root edits are not supported.");
	}

	// start from root, follow the patht, go go and go...
	let parent: unknown = root;
	for (const token of pathTokens.slice(0, -1)) {
		parent = walk(parent, token, path);
	}

	const token = pathTokens[pathTokens.length - 1];
	if (token === "-" && !options.allowAppend) {
		throw new Error(`Append token is only valid for add: ${path}`);
	}
	if (!isContainer(parent)) {
		throw new Error(`Path parent is not editable: ${path}`);
	}

	if (Array.isArray(parent)) {
		if (token === "-") {
			return { target: undefined, parent };
		}
		return {
			target: parent[
				guardArrIdx(parent, token, { allowEnd: options.allowAppend })
			],
			parent,
		};
	}

	if (!(token in parent)) {
		if (options.allowAppend) {
			return { target: undefined, parent };
		}
		throw new Error(`Unknown path: ${path}`);
	}
	return { target: parent[token], parent };
}

function set(ref: TargetRef, path: string, value: unknown): void {
	const token = lastToken(path);
	if (Array.isArray(ref.parent)) {
		ref.parent[guardArrIdx(ref.parent, token)] = value;
		return;
	}

	if (!(token in ref.parent)) {
		throw new Error(`Unknown path: ${path}`);
	}
	ref.parent[token] = value;
}

function apply(
	current: unknown,
	value: unknown,
	path: string,
): string | null {
	if (!isDomRecord(current)) {
		return null;
	}

	if (typeof value === "string" && current.type === "text") {
		current.value = value;
		return `${path}/value`;
	}

	if (!isRecord(value)) {
		return null;
	}

	const updated: string[] = [];
	if ("value" in value) {
		current.value = value.value;
		updated.push("value");
	}
	if ("attributes" in value) {
		current.attributes = value.attributes;
		updated.push("attributes");
	}
	if ("children" in value) {
		current.children = value.children;
		updated.push("children");
	}

	if (!updated.length) {
		return null;
	}
	return updated.length === 1 ? `${path}/${updated[0]}` : path;
}

function isDomRecord(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && typeof value.type === "string";
}

// Reads one intermediate path segment while walking down a JSON Pointer.
function walk(parent: unknown, token: string, path: string): unknown {
	if (Array.isArray(parent)) {
		return parent[guardArrIdx(parent, token)];
	}

	if (isRecord(parent)) {
		if (!(token in parent)) {
			throw new Error(`Unknown path: ${path}`);
		}
		return parent[token];
	}
	throw new Error(`Path parent is not editable: ${path}`);
}

// Split resume paths into object keys and array indexes. Resume keys do not
// contain "/" or "~", so we intentionally skip full JSON Pointer escaping.
function ptr(path: string): string[] {
	return path.slice(1).split("/");
}

function lastToken(path: string): string {
	const tokens = ptr(path);
	const token = tokens[tokens.length - 1];
	if (token === undefined) {
		throw new Error("Root edits are not supported.");
	}
	return token;
}

// Validates array indexes. For add, index === array.length is allowed; for
// reads/replaces/removes, the index must point at an existing element.
function guardArrIdx(
	array: unknown[],
	token: string,
	options: { allowEnd?: boolean } = {},
): number {
	if (!/^(0|[1-9]\d*)$/.test(token)) {
		throw new Error(`Invalid array index: ${token}`);
	}

	const idx = Number(token);
	const max = options.allowEnd ? array.length : array.length - 1;
	if (idx < 0 || idx > max) {
		throw new Error(`Array index out of range: ${token}`);
	}
	return idx;
}

// Applies resume-specific safety checks only when the generic JSON path could
// affect DOM nodes or attributes.
function guard(path: string, value: unknown): void {
	if (path === "/tree/root" || path.startsWith("/tree/root/")) {
		guardDom(value);
	}
	if (path.includes("/attributes")) {
		guardAttrVal(value, path);
	}
}

// Recursively checks inserted/replaced DOM-ish values for blocked element tags
// and unsafe attributes before they can enter the resume tree.
function guardDom(value: unknown): void {
	if (Array.isArray(value)) {
		value.forEach(guardDom);
		return;
	}
	if (!isRecord(value)) {
		return;
	}

	if (value.type === "element") {
		const tagName = String(value.tagName ?? "").toLowerCase();
		if (!tagName || BLOCKED_INSERT_TAGS.has(tagName)) {
			throw new Error(`Unsafe inserted tag: ${tagName}`);
		}
	}

	if (isRecord(value.attributes)) {
		guardAttrVal(value.attributes);
	}

	if (Array.isArray(value.children)) {
		value.children.forEach(guardDom);
	}
}

// Checks both whole attribute objects and single attribute value replacements.
function guardAttrVal(value: unknown, path = ""): void {
	if (typeof value === "string") {
		const tokens = ptr(path);
		const attrName = tokens[tokens.length - 1] ?? "";
		if (attrName.toLowerCase().startsWith("on")) {
			throw new Error(`Unsafe attribute: ${attrName}`);
		}
		if (/^\s*javascript:/i.test(value)) {
			throw new Error(`Unsafe attribute value: ${attrName}`);
		}
		return;
	}

	if (!isRecord(value)) {
		return;
	}

	for (const [name, attrValue] of Object.entries(value)) {
		if (name.toLowerCase().startsWith("on")) {
			throw new Error(`Unsafe attribute: ${name}`);
		}
		if (
			typeof attrValue === "string" &&
			/^\s*javascript:/i.test(attrValue)
		) {
			throw new Error(`Unsafe attribute value: ${name}`);
		}
	}
}

// Build a successful operation result using the existing toast/result shape.
function ok(message: string, action: PatchAction): PatchResult {
	return {
		ok: true,
		action,
		message,
	};
}

// Build a failed operation result using the existing toast/result shape.
function fail(message: string, action?: string): PatchResult {
	return {
		ok: false,
		action: action,
		message,
	};
}

// Deep equality for JSON-safe values. Resume diffs are JSON-only, so stringify
// comparison is sufficient and keeps "test" simple.
function jsonEqual(left: unknown, right: ResumeJsonPatchValue): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

// A JSON Pointer can only continue through an object or array.
function isContainer(value: unknown): value is JsonContainer {
	return Array.isArray(value) || isRecord(value);
}

// Narrow unknown values to plain object records, excluding arrays.
function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

// Clone JSON-safe resume/diff values so operations never share mutable input.
function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
