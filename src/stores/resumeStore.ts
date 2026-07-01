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
    this.previewDocument = doc;
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    if (!this.previewDocument) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }

    return applyPatches(this.previewDocument, patches);
  }
}
