// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import {
  BLOCKED_TAGS,
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

  get doc(): Document | undefined {
    return this.previewDocument;
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

  private get resumePages(): HTMLElement[] {
    const doc = this.previewDocument;
    if (!doc) {
      return [];
    }

    ensureResumePageAttributes(doc);
    return Array.from(doc.querySelectorAll<HTMLElement>(RESUME_SELECTORS.resume));
  }

  get resumeSummary(): string {
    const pages = this.resumePages;
    if (!pages.length) {
      return "";
    }

    const summary = pages
      .map((page, index) => {
        const pageNumber = page.dataset.resumePage || String(index + 1);
        const pageSelector = page.id ? `#${page.id}` : `[data-resume-page="${pageNumber}"]`;
        const pageClasses = Array.from(page.classList).map((className) => `.${className}`).join("");
        const pageId = page.id ? `#${page.id}` : "";
        const lines = [
          `Page ${pageNumber}`,
          `Selector: ${pageSelector}`,
          `Root: ${page.tagName.toLowerCase()}${pageId}${pageClasses}[data-resume-page="${pageNumber}"]`
        ];

        Array.from(page.children).forEach((child, childIndex) => {
          const element = child as HTMLElement;
          const classNames = Array.from(element.classList).map((className) => `.${className}`).join("");
          const id = element.id ? `#${element.id}` : "";
          const pageData = element.dataset.resumePage ? `[data-resume-page="${element.dataset.resumePage}"]` : "";
          const elementLabel = `${element.tagName.toLowerCase()}${id}${classNames}${pageData}`;
          const heading = (element.querySelector("h1, h2, h3")?.textContent ?? "").replace(/\s+/g, " ").trim();
          const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
          const textPreview = text.length > MAX_TEXT_PREVIEW_CHARS
            ? `${text.slice(0, MAX_TEXT_PREVIEW_CHARS)}...`
            : text;
          const details = [
            `${childIndex + 1}. ${elementLabel}`,
            heading ? `heading="${heading}"` : "",
            textPreview ? `text="${textPreview}"` : ""
          ].filter(Boolean);

          lines.push(details.join(" "));
        });

        return lines.join("\n");
      })
      .join("\n\n");

    return summary.length > MAX_RESUME_SUMMARY_CHARS
      ? `${summary.slice(0, MAX_RESUME_SUMMARY_CHARS)}\n...[resume summary truncated]`
      : summary;
  }

  get resumeDom(): string {
    const doc = this.previewDocument;
    if (!doc) {
      return "";
    }

    const root = doc.querySelector<HTMLElement>(RESUME_SELECTORS.root);
    if (!root) {
      return "";
    }

    ensureResumePageAttributes(doc);
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(UNSAFE_CONTEXT_SELECTORS).forEach((node) => node.remove());
    const html = clone.outerHTML
      .replace(/\s+/g, " ")
      .replace(/>\s+</g, "><")
      .trim();

    return html.length > MAX_RESUME_DOM_CHARS
      ? `${html.slice(0, MAX_RESUME_DOM_CHARS)}\n...[resume DOM truncated]`
      : html;
  }

  get structureSummary(): string {
    return this.resumeSummary;
  }

  printPreview(): void {
    const previewWindow = this.previewDocument?.defaultView;
    if (!previewWindow || !this.previewDocument) {
      return;
    }

    previewWindow.focus();
    previewWindow.print();
  }

  print(): void {
    this.printPreview();
  }

  setPreviewDocument(doc: Document | undefined): void {
    if (doc && !doc.querySelector(RESUME_SELECTORS.root)) {
      return;
    }

    this.previewDocument = doc;
    if (doc) {
      ensureResumePageAttributes(doc);
      this.previewHtml = this.serializeDocument(doc);
    }
  }

  setDoc(doc: Document | undefined): void {
    this.setPreviewDocument(doc);
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    if (!this.previewDocument) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }
    if (!this.previewDocument.querySelector(RESUME_SELECTORS.root)) {
      return [{ ok: false, action: PatchAction.Preview, message: "Resume preview document is not loaded." }];
    }

    const beforeHtml = this.serializeDocument(this.previewDocument);
    ensureResumePageAttributes(this.previewDocument);
    const results = applyPatches(this.previewDocument, patches, {
      allowedCustomProperties: this.allowedCssCustomProperties
    });
    ensureResumePageAttributes(this.previewDocument);
    const afterHtml = this.serializeDocument(this.previewDocument);

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
      this.previewHtml = this.serializeDocument(this.previewDocument);
    }

    return {
      html: this.previewHtml
    };
  }

  loadSnapshot(snapshot: ResumeSnapshot): void {
    this.previewHtml = this.sanitizeHtml(snapshot.html);
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

  private serializeDocument(doc: Document): string {
    this.sanitizeDocument(doc);
    ensureResumePageAttributes(doc);
    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  }

  private sanitizeHtml(html: string): string {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return this.serializeDocument(doc);
  }

  private sanitizeDocument(doc: Document): void {
    Array.from(doc.querySelectorAll("*")).forEach((element) => {
      if (BLOCKED_TAGS.has(element.tagName)) {
        element.remove();
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.trim().toLowerCase();
        if (name.startsWith("on") || value.startsWith("javascript:")) {
          element.removeAttribute(attribute.name);
        }
      });
    });
  }
}

function ensureResumePageAttributes(doc: Document): void {
  Array.from(doc.querySelectorAll<HTMLElement>(RESUME_SELECTORS.resume)).forEach((page, index) => {
    const pageNumber = String(index + 1);
    page.dataset.resumePage = page.dataset.resumePage || pageNumber;
    page.id = page.id || `page-${pageNumber.padStart(2, "0")}`;
  });
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
