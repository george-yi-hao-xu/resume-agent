// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import { applyPatches } from "../core/patchEngine";
import { getAllowedCssCustomProperties } from "../core/cssCustomProperties";
import { RESUME_SELECTORS } from "../core/resumeSelectors";
import { initialPreviewHtml } from "../components/previewHtml";
import { PatchAction, type PatchResult, type UiPatch } from "../types";

export type ResumeSnapshot = {
  html: string;
};

export type ResumeHistoryEntry = {
  id: string;
  patches: UiPatch[];
  results: PatchResult[];
  beforeHtml: string;
  afterHtml: string;
  createdAt: string;
};

const MAX_HISTORY_ENTRIES = 100;

export class ResumeStore {
  previewDocument?: Document;
  private previewHtml = initialPreviewHtml;
  private undoStack: ResumeHistoryEntry[] = [];
  private redoStack: ResumeHistoryEntry[] = [];

  constructor() {
    makeAutoObservable(this, {
      previewDocument: observable.ref
    });
  }

  get html(): string {
    return this.previewHtml;
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

  get allowedCssCustomProperties(): string[] {
    return this.previewDocument ? getAllowedCssCustomProperties(this.previewDocument) : [];
  }

  get structureSummary(): string {
    const root = this.previewDocument?.querySelector<HTMLElement>(RESUME_SELECTORS.resume);
    if (!root) {
      return "";
    }

    return Array.from(root.children)
      .map((child, index) => {
        const element = child as HTMLElement;
        const classNames = Array.from(element.classList).map((className) => `.${className}`).join(" ");
        const heading = element.querySelector("h1, h2, h3")?.textContent?.trim();
        const label = heading ? ` "${heading}"` : "";
        return `${index + 1}. ${element.tagName.toLowerCase()} ${classNames}${label}`.trim();
      })
      .join("\n");
  }

  printPreview(): void {
    const previewWindow = this.previewDocument?.defaultView;
    if (!previewWindow || !this.previewDocument) {
      return;
    }

    previewWindow.focus();
    previewWindow.print();
  }

  setPreviewDocument(doc: Document | undefined): void {
    if (doc && !doc.querySelector(RESUME_SELECTORS.root)) {
      return;
    }

    this.previewDocument = doc;
    if (doc) {
      this.previewHtml = serializeDocument(doc);
    }
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    if (!this.previewDocument) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }
    if (!this.previewDocument.querySelector(RESUME_SELECTORS.root)) {
      return [{ ok: false, action: PatchAction.Preview, message: "Resume preview document is not loaded." }];
    }

    const beforeHtml = serializeDocument(this.previewDocument);
    const results = applyPatches(this.previewDocument, patches, {
      allowedCustomProperties: this.allowedCssCustomProperties
    });
    const afterHtml = serializeDocument(this.previewDocument);

    this.previewHtml = afterHtml;
    if (afterHtml !== beforeHtml) {
      this.recordHistoryEntry({
        id: createHistoryId(),
        patches: cloneJson(patches),
        results: cloneJson(results),
        beforeHtml,
        afterHtml,
        createdAt: new Date().toISOString()
      });
    }

    return results;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) {
      return false;
    }

    this.redoStack.push(entry);
    this.restoreHtml(entry.beforeHtml);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) {
      return false;
    }

    this.undoStack.push(entry);
    this.restoreHtml(entry.afterHtml);
    return true;
  }

  getSnapshot(): ResumeSnapshot {
    if (this.previewDocument) {
      this.previewHtml = serializeDocument(this.previewDocument);
    }

    return {
      html: this.previewHtml
    };
  }

  loadSnapshot(snapshot: ResumeSnapshot): void {
    this.previewHtml = snapshot.html;
    this.previewDocument = undefined;
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

  private restoreHtml(html: string): void {
    this.previewHtml = html;
    this.previewDocument = undefined;
  }
}

function serializeDocument(doc: Document): string {
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
