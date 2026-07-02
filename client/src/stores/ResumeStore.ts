// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import { applyPatches } from "../core/patchEngine";
import { RESUME_SELECTORS } from "../core/resumeSelectors";
import { initialPreviewHtml } from "../components/previewHtml";
import { PatchAction, type PatchResult, type PreviewContext, type PreviewContextElement, type UiPatch } from "../types";

export type ResumeSnapshot = {
  html: string;
};

export class ResumeStore {
  previewDocument?: Document;
  private previewHtml = initialPreviewHtml;

  constructor() {
    makeAutoObservable(this, {
      previewDocument: observable.ref
    });
  }

  get html(): string {
    return this.previewHtml;
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

    return applyPatches(this.previewDocument, patches);
  }

  getPreviewContext(): PreviewContext {
    if (!this.previewDocument) {
      return { elements: [], insertion_targets: [] };
    }

    const root = this.previewDocument.querySelector<HTMLElement>(RESUME_SELECTORS.root);
    if (!root) {
      return { elements: [], insertion_targets: [] };
    }

    return {
      elements: getEditableElements(this.previewDocument, root),
      insertion_targets: getInsertionTargets(this.previewDocument, root)
    };
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
  }
}

function serializeDocument(doc: Document): string {
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

const EDITABLE_TEXT_SELECTOR = "h1,h2,h3,p,span,li";
const INSERTION_TARGET_SELECTOR = [
  RESUME_SELECTORS.root,
  RESUME_SELECTORS.skillsList,
  RESUME_SELECTORS.experienceList,
  RESUME_SELECTORS.projectList,
  RESUME_SELECTORS.bulletList
].join(",");

function getEditableElements(doc: Document, root: HTMLElement): PreviewContextElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(EDITABLE_TEXT_SELECTOR))
    .map((element) => toContextElement(doc, root, element))
    .filter((item): item is PreviewContextElement => item !== null);
}

function getInsertionTargets(doc: Document, root: HTMLElement): PreviewContextElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(INSERTION_TARGET_SELECTOR))
    .concat(root)
    .filter((element, index, elements) => elements.indexOf(element) === index)
    .map((element) => toContextElement(doc, root, element, getInsertionRole(element)))
    .filter((item): item is PreviewContextElement => item !== null);
}

function toContextElement(
  doc: Document,
  root: HTMLElement,
  element: HTMLElement,
  role = getElementRole(element)
): PreviewContextElement | null {
  const selector = getUniqueSelector(doc, root, element);
  if (!selector) {
    return null;
  }

  const text = normalizeText(element.textContent ?? "");
  return {
    selector,
    tag: element.tagName.toLowerCase(),
    role,
    ...(text ? { text } : {})
  };
}

function getUniqueSelector(doc: Document, root: HTMLElement, element: HTMLElement): string | null {
  if (element === root) {
    return RESUME_SELECTORS.root;
  }

  const editId = element.getAttribute("data-edit-id");
  if (editId) {
    return `[data-edit-id="${escapeCssString(editId)}"]`;
  }

  for (const className of Array.from(element.classList)) {
    const selector = `.${escapeCssIdentifier(className)}`;
    if (doc.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  const segments: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== root) {
    segments.unshift(getSelectorSegment(current));
    current = current.parentElement;
  }

  const selector = `${RESUME_SELECTORS.root} > ${segments.join(" > ")}`;
  return doc.querySelectorAll(selector).length === 1 ? selector : null;
}

function getSelectorSegment(element: HTMLElement): string {
  const classNames = Array.from(element.classList).slice(0, 2).map(escapeCssIdentifier);
  const classSelector = classNames.length ? `.${classNames.join(".")}` : "";
  return `${element.tagName.toLowerCase()}${classSelector}:nth-of-type(${getNthOfType(element)})`;
}

function getNthOfType(element: HTMLElement): number {
  let index = 1;
  let current = element.previousElementSibling;

  while (current) {
    if (current.tagName === element.tagName) {
      index += 1;
    }
    current = current.previousElementSibling;
  }

  return index;
}

function getElementRole(element: HTMLElement): string {
  for (const className of Array.from(element.classList)) {
    if (className.endsWith("-name")) {
      return "name";
    }
    if (className.endsWith("-title")) {
      return "title";
    }
    if (className.endsWith("-email") || className.endsWith("-phone") || className.endsWith("-location")) {
      return "contact";
    }
    if (className.includes("summary")) {
      return "summary";
    }
    if (className.includes("meta")) {
      return "metadata";
    }
  }

  return element.tagName.toLowerCase() === "li" ? "list-item" : "text";
}

function getInsertionRole(element: HTMLElement): string {
  if (element.matches(RESUME_SELECTORS.skillsList)) {
    return "skills insertion target";
  }
  if (element.matches(RESUME_SELECTORS.experienceList)) {
    return "experience insertion target";
  }
  if (element.matches(RESUME_SELECTORS.projectList)) {
    return "project insertion target";
  }
  if (element.matches(RESUME_SELECTORS.bulletList)) {
    return "bullet insertion target";
  }
  return "resume insertion target";
}

function normalizeText(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function escapeCssIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
