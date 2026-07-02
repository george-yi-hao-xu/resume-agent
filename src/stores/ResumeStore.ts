// ResumeStore.ts

import { makeAutoObservable, observable } from "mobx";
import { applyPatches } from "../core/patchEngine";
import { initialPreviewHtml } from "../components/previewHtml";
import { PatchAction, type PatchResult, type UiPatch } from "../types";

export class ResumeStore {
  previewDocument?: Document;

  constructor() {
    makeAutoObservable(this, {
      previewDocument: observable.ref
    });
  }

  initializePreview(frame: HTMLIFrameElement | null): void {
    if (frame) {
      frame.srcdoc = initialPreviewHtml;
    }
  }

  setPreviewDocument(doc: Document | undefined): void {
    if (doc && !doc.querySelector("[data-resume-root]")) {
      return;
    }

    this.previewDocument = doc;
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    if (!this.previewDocument) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }
    if (!this.previewDocument.querySelector("[data-resume-root]")) {
      return [{ ok: false, action: PatchAction.Preview, message: "Resume preview document is not loaded." }];
    }

    return applyPatches(this.previewDocument, patches);
  }
}
