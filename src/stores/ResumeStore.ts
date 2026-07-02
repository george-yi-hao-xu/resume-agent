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

    return applyPatches(this.previewDocument, patches, {
      allowedCustomProperties: this.allowedCssCustomProperties
    });
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
