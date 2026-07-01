import { makeAutoObservable, observable } from "mobx";
import { applyPatches } from "../core/patchEngine";
import { initialPreviewHtml } from "../components/previewHtml";
import { PatchAction, type PatchResult, type UiPatch } from "../types";

export class ResumeStore {
  previewDocument?: Document;

  constructor() {
    console.log("[ResumeStore.constructor]");
    makeAutoObservable(this, {
      previewDocument: observable.ref
    });
  }

  initializePreview(frame: HTMLIFrameElement | null): void {
    console.log("[ResumeStore.initializePreview]", { hasFrame: !!frame });
    if (frame) {
      frame.srcdoc = initialPreviewHtml;
    }
  }

  setPreviewDocument(doc: Document | undefined): void {
    console.log("[ResumeStore.setPreviewDocument]", {
      hasDocument: !!doc,
      hasResumeRoot: !!doc?.querySelector("[data-resume-root]"),
      hasSkillsList: !!doc?.querySelector(".skills-list"),
      url: doc?.URL
    });
    if (doc && !doc.querySelector("[data-resume-root]")) {
      console.log("[ResumeStore.setPreviewDocument:skipNonResumeDocument]");
      return;
    }

    this.previewDocument = doc;
  }

  applyPatches(patches: UiPatch[]): PatchResult[] {
    console.log("[ResumeStore.applyPatches]", {
      hasDocument: !!this.previewDocument,
      hasResumeRoot: !!this.previewDocument?.querySelector("[data-resume-root]"),
      hasSkillsList: !!this.previewDocument?.querySelector(".skills-list"),
      patches
    });
    if (!this.previewDocument) {
      return [{ ok: false, action: PatchAction.Preview, message: "Preview iframe is not ready." }];
    }
    if (!this.previewDocument.querySelector("[data-resume-root]")) {
      return [{ ok: false, action: PatchAction.Preview, message: "Resume preview document is not loaded." }];
    }

    return applyPatches(this.previewDocument, patches);
  }
}
