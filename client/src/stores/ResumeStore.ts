// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import {
  MAX_HISTORY_ENTRIES,
  MAX_RESUME_DOM_CHARS,
  MAX_RESUME_SUMMARY_CHARS,
  MAX_TEXT_PREVIEW_CHARS,
  UNSAFE_CONTEXT_SELECTORS
} from "../constants";
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

export class ResumeStore {
  doc?: Document;
  private htmlStr = initialPreviewHtml;
  private undoStack: ResumeHistoryEntry[] = [];
  private redoStack: ResumeHistoryEntry[] = [];
  private wildPreviewMode = false;

  constructor() {
    makeAutoObservable(this);
  }

  get html(): string {
    return this.htmlStr;
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
    return this.doc ? getAllowedCssCustomProperties(this.doc) : [];
  }

  get resumeSummary(): string {
    const pages = this.getResumePages;
    if (!pages.length) {
      return "";
    }

    const summary = pages
      .map((page, index) => {
        const pageNumber = getResumePageNumber(page, index);
        const lines = [
          `Page ${pageNumber}`,
          `Selector: ${buildResumePageSelector(page, pageNumber)}`,
          `Root: ${describeElement(page)}`
        ];

        Array.from(page.children).forEach((child, childIndex) => {
          const element = child as HTMLElement;
          const heading = normStr(element.querySelector("h1, h2, h3")?.textContent ?? "");
          const textPreview = cutStr(normStr(element.textContent ?? ""), MAX_TEXT_PREVIEW_CHARS);
          const details = [
            `${childIndex + 1}. ${describeElement(element)}`,
            heading ? `heading="${heading}"` : "",
            textPreview ? `text="${textPreview}"` : ""
          ].filter(Boolean);

          lines.push(details.join(" "));
        });

        return lines.join("\n");
      })
      .join("\n\n");

    return cutStrLen(summary, MAX_RESUME_SUMMARY_CHARS, "resume summary");
  }

  get resumeDom(): string {
    const doc = this.doc;
    if (!doc) {
      return "";
    }

    const root = doc.querySelector<HTMLElement>(RESUME_SELECTORS.root);
    if (!root) {
      return "";
    }

    this.maintain();
    return cutStrLen(serializeContextElement(root), MAX_RESUME_DOM_CHARS, "resume DOM");
  }

  get structureSummary(): string {
    return this.resumeSummary;
  }

  print(): void {
    const previewWindow = this.doc?.defaultView;
    if (!previewWindow || !this.doc) {
      return;
    }

    previewWindow.focus();
    previewWindow.print();
  }

  setDoc(doc: Document | undefined): void {
    if (doc && !this.wildPreviewMode && !doc.querySelector(RESUME_SELECTORS.root)) {
      return;
    }

    this.doc = doc;
    if (doc) {
      this.maintain();
      this.htmlStr = this.serializedDoc;
    }
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    if (!this.doc) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }
    if (!this.doc.querySelector(RESUME_SELECTORS.root)) {
      return [{ ok: false, action: PatchAction.Preview, message: "Resume preview document is not loaded." }];
    }

    const beforeHtml = this.serializedDoc;
    this.wildPreviewMode = false;
    this.maintain();
    const results = applyPatches(this.doc, patches, {
      allowedCustomProperties: this.allowedCssCustomProperties
    });
    this.maintain();
    const afterHtml = this.serializedDoc;

    console.log("patch applied: ", afterHtml);
    this.htmlStr = afterHtml;

    if (afterHtml !== beforeHtml) {
      this.recordHistoryEntry({
        id: createHistoryId(),
        patches: {...patches},
        results: {...results},
        beforeHtml,
        afterHtml,
        createdAt: new Date().toISOString()
      });
    }

    return results;
  }

  replaceWithWildHtml(html: string): PatchResult[] {
    const beforeHtml = this.doc ? this.serializedDoc : this.htmlStr;
    const afterHtml = html;
    const results = [{
      ok: true,
      action: PatchAction.WildDom,
      message: "Wild mode replaced the full preview DOM."
    }];

    console.log("afterHtml (wild): ", afterHtml);

    this.wildPreviewMode = true;
    this.htmlStr = afterHtml;
    this.doc = undefined;

    if (afterHtml !== beforeHtml) {
      this.recordHistoryEntry({
        id: createHistoryId(),
        patches: [],
        results,
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
    if (this.doc) {
      this.htmlStr = this.serializedDoc;
    }

    return {
      html: this.htmlStr
    };
  }

  loadSnapshot(snapshot: ResumeSnapshot): void {
    this.wildPreviewMode = false;
    this.htmlStr = snapshot.html;
    this.doc = undefined;
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
    this.htmlStr = html;
    this.doc = undefined;
  }

  private get getResumePages(){
    if (!this.doc) {
      return [];
    }

    // ensureResumePageAttributes(this.previewDocument);
    return Array.from(this.doc.querySelectorAll<HTMLElement>(RESUME_SELECTORS.resume));
  }

  private maintain(){
    if (!this.doc) return;

    Array.from(this.doc.querySelectorAll<HTMLElement>(RESUME_SELECTORS.resume)).forEach((page, index) => {
      const pageNumber = String(index + 1);
      page.dataset.resumePage = page.dataset.resumePage || pageNumber;
      page.id = page.id || `page-${pageNumber.padStart(2, "0")}`;
    });
  }

  private get serializedDoc(){
    this.maintain();
    if(!this.doc) return ''
    return `<!doctype html>\n${this.doc.documentElement.outerHTML}`;
  }
}

function getResumePageNumber(page: HTMLElement, index: number): string {
  return page.dataset.resumePage || String(index + 1);
}

function buildResumePageSelector(page: HTMLElement, pageNumber: string): string {
  if (page.id) {
    return `#${page.id}`;
  }

  return `[data-resume-page="${pageNumber}"]`;
}

function describeElement(element: HTMLElement): string {
  const classNames = Array.from(element.classList).map((className) => `.${className}`).join("");
  const id = element.id ? `#${element.id}` : "";
  const page = element.dataset.resumePage ? `[data-resume-page="${element.dataset.resumePage}"]` : "";
  return `${element.tagName.toLowerCase()}${id}${classNames}${page}`;
}

function serializeContextElement(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(UNSAFE_CONTEXT_SELECTORS).forEach((node) => node.remove());
  return normalizeContextHtml(clone.outerHTML);
}

function normalizeContextHtml(html: string): string {
  return html
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
}

function normStr(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function cutStr(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...`;
}

function cutStrLen(value: string, maxChars: number, label: string): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n...[${label} truncated]`;
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
