// ResumeStore.ts

import { makeAutoObservable } from "mobx";
import { MAX_HISTORY_ENTRIES } from "../constants";
import { applyResumeVTreePatches } from "../core/resumeVTreePatchEngine";
import { PAGE_LAYOUT, type PatchResult, type UiPatch } from "../types";
import { Resume } from "../resume.types";
import { default_manifest } from "../core/default_manifest";

export type ResumeSnapshot = {
  tree: ResumeVTree;
};

export type ResumeHistoryEntry = {
  id: string;
  patches: UiPatch[];
  results: PatchResult[];
  beforeTree: ResumeVTree;
  afterTree: ResumeVTree;
  createdAt: string;
};

export class ResumeStore {
  pageLayout = PAGE_LAYOUT.VERT;
  resume: Resume = default_manifest;
  styles = [];
  undoStack: ResumeHistoryEntry[] = [];
  redoStack: ResumeHistoryEntry[] = [];

  constructor() {
    makeAutoObservable(this);
  }


  // for iframe

  get tree() {
    return this.resume;
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
    const beforeTree = cloneTree(this.resumeTree);
    const patchResult = applyResumeVTreePatches(this.resumeTree, patches);

    if (patchResult.changed) {
      this.resumeTree = patchResult.tree;
      this.recordHistoryEntry({
        id: createHistoryId(),
        patches: cloneJson(patches),
        results: cloneJson(patchResult.results),
        beforeTree,
        afterTree: cloneTree(patchResult.tree),
        createdAt: new Date().toISOString(),
      });
    }

    return patchResult.results;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) {
      return false;
    }

    this.redoStack.push(entry);
    this.restoreTree(entry.beforeTree);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) {
      return false;
    }

    this.undoStack.push(entry);
    this.restoreTree(entry.afterTree);
    return true;
  }

  getSnapshot(): ResumeSnapshot {
    return {
      tree: cloneTree(this.resumeTree),
    };
  }

  loadSnapshot(snapshot: ResumeSnapshot): void {
    this.resumeTree = maintainResumeVTree(snapshot.tree);
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

  private restoreTree(tree: ResumeVTree): void {
    this.resume = cloneTree(tree);
  }
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
