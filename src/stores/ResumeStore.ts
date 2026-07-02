// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import { applyPatches } from "../core/patchEngine";
import { RESUME_SELECTORS } from "../core/resumeSelectors";
import { initialPreviewHtml } from "../components/previewHtml";
import { PatchAction, type PatchResult, type UiPatch } from "../types";

export class ResumeStore {
  previewFrame?: HTMLIFrameElement;
  previewDocument?: Document;

  constructor() {
    makeAutoObservable(this, {
      previewFrame: observable.ref,
      previewDocument: observable.ref
    });
  }

  initializePreview(frame: HTMLIFrameElement | null): void {
    if (frame) {
      this.previewFrame = frame;
      frame.srcdoc = initialPreviewHtml;
    }
  }

  printPreview(): void {
    const previewWindow = this.previewFrame?.contentWindow;
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
}
