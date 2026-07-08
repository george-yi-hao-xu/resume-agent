// ResumeStore.ts

import { makeAutoObservable } from "mobx";
import { createId } from "../core/utils";
import { MAX_HISTORY_ENTRIES } from "../constants";
import { apply } from "../core/patch_engine/patchEngine";
import { applyDiff as applyResumeDiff } from "../core/diff_engine/applyDiff";
import { PAGE_LAYOUT } from "../types";
import type { UiPatch, PatchResult, ResumeDiffOp } from "@repo/schema";
import { Resume } from "@repo/schema/src/resume.types";
import { default_manifest } from "../core/default_manifest";
import { render } from "../core/render";
import { maintainResumeWd, withResumeWd } from "../core/resumeWd";

export type ResumeHistoryEntry = {
	id: string;
	patches?: UiPatch[];
	diffs?: ResumeDiffOp[];
	results: PatchResult[];
	before: Resume;
	after: Resume;
	createdAt: string;
};

export class ResumeStore {
	pageLayout = PAGE_LAYOUT.VERT;
	resume: Resume = withResumeWd(default_manifest);
	undoStack: ResumeHistoryEntry[] = [];
	redoStack: ResumeHistoryEntry[] = [];

	constructor() {
		this.maintainResumeWd();
		makeAutoObservable(this);
	}

	// for iframe from this.resume
	get srcDoc(): string {
		return render(this.resume);
	}

	// for llm
	get fullDomStr() {
		return JSON.stringify(this.resume);
	}

	// for llm also
	get summaryDomStr() {
		// only difference w/ this.fullDomStr is that this one doesn't have text inside
		const summary = cloneJson(this.resume);

		const walk = (node: any): void => {
			if (!node || typeof node !== "object") {
				return;
			}

			if (node.type === "text") {
				node.value = "";
				return;
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					walk(child);
				}
			}
		};

		walk(summary.tree.root);
		return JSON.stringify(summary);
	}

	get allowClassNames() {
		const classNames = new Set<string>();

		const walk = (node: any): void => {
			if (!node || typeof node !== "object") {
				return;
			}

			const classAttr = node.attributes?.class;
			if (typeof classAttr === "string" && classAttr.trim()) {
				for (const name of classAttr.split(/\s+/)) {
					if (name) {
						classNames.add(name);
					}
				}
			}

			if (Array.isArray(node.children)) {
				for (const child of node.children) {
					walk(child);
				}
			}
		};

		walk(this.resume.tree.root);
		return Array.from(classNames);
	}

	get history(): ResumeHistoryEntry[] {
		return this.undoStack.slice();
	}

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	get undoCount(): number {
		return this.undoStack.length;
	}

	get redoCount(): number {
		return this.redoStack.length;
	}

	setPageLayout(value: PAGE_LAYOUT): void {
		this.pageLayout = value;
	}

	applyPatches(patches: UiPatch[]): PatchResult[] {
		const before = cloneJson(this.resume);
		const patchResult = apply(this.resume, patches);

		if (patchResult.changed) {
			this.resume = withResumeWd(patchResult.new);
			this.recordHistoryEntry({
				id: createHistoryId(),
				patches: cloneJson(patches),
				results: cloneJson(patchResult.results),
				before,
				after: cloneJson(this.resume),
				createdAt: new Date().toISOString(),
			});
		}

		return patchResult.results;
	}

	applyDiff(diffs: ResumeDiffOp[]): PatchResult[] {
		const before = cloneJson(this.resume);
		const diffResult = applyResumeDiff(this.resume, diffs);

		if (diffResult.changed) {
			this.resume = withResumeWd(diffResult.new);
			this.recordHistoryEntry({
				id: createHistoryId(),
				diffs: cloneJson(diffs),
				results: cloneJson(diffResult.results),
				before,
				after: cloneJson(this.resume),
				createdAt: new Date().toISOString(),
			});
		}

		return diffResult.results;
	}

	undo(): boolean {
		const entry = this.undoStack.pop();
		if (!entry) {
			return false;
		}

		this.redoStack.push(entry);
		this.restore(entry.before);
		return true;
	}

	redo(): boolean {
		const entry = this.redoStack.pop();
		if (!entry) {
			return false;
		}

		this.undoStack.push(entry);
		this.restore(entry.after);
		return true;
	}

	getSnapshot() {
		return {
			...this.resume,
		};
	}

	loadSnapshot(snapshot: Resume): void {
		this.resume = withResumeWd({
			...this.resume,
			...snapshot,
		});
		this.clearHistory();
	}

	clearHistory(): void {
		this.undoStack = [];
		this.redoStack = [];
	}

	private recordHistoryEntry(entry: ResumeHistoryEntry): void {
		this.undoStack.push(entry);
		if (this.undoStack.length > MAX_HISTORY_ENTRIES) {
			this.undoStack.shift();
		}
		this.redoStack = [];
	}

	private restore(r: Resume): void {
		this.resume = withResumeWd({
			...this.resume,
			...r,
		});
	}

	private maintainResumeWd(): void {
		maintainResumeWd(this.resume);
	}
}

function createHistoryId(): string {
	return createId("history");
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
