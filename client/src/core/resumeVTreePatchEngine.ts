import { PatchAction, type PatchResult, type UiPatch } from "../types";
import { cloneTree, serializeResumeVTree, type ResumeVTree } from "./resumeVTree";
import {
  getAllowedCssCustomPropertiesFromTree,
  maintainResumeVTree
} from "./resumeVTreeDerived";
import {
  applyInsertHtmlPatch,
  applyRemoveElementPatch,
  applyUpdateCssPatch,
  applyUpdateTextPatch
} from "./resumeVTreeBasicPatches";
import { applyClonePagePatch } from "./resumeVTreeClonePagePatch";
import { applySectionLayoutPatch } from "./resumeVTreeSectionLayoutPatch";

export type ResumeVTreePatchResult = {
  tree: ResumeVTree;
  results: PatchResult[];
  changed: boolean;
};

export function applyResumeVTreePatches(tree: ResumeVTree, patches: UiPatch[]): ResumeVTreePatchResult {
  const beforeTree = maintainResumeVTree(tree);
  const nextTree = cloneTree(beforeTree);

  if (!Array.isArray(patches)) {
    return {
      tree: nextTree,
      results: [{ ok: false, action: PatchAction.Unknown, message: "Patch payload must be an array." }],
      changed: false
    };
  }

  const allowedCustomProperties = new Set(getAllowedCssCustomPropertiesFromTree(nextTree));
  const results = patches.map((patch) => applyPatch(nextTree, patch, allowedCustomProperties));
  const afterTree = maintainResumeVTree(nextTree);

  return {
    tree: afterTree,
    results,
    changed: serializeResumeVTree(afterTree) !== serializeResumeVTree(beforeTree)
  };
}

function applyPatch(tree: ResumeVTree, patch: UiPatch, allowedCustomProperties: Set<string>): PatchResult {
  try {
    switch (patch.action) {
      case PatchAction.UpdateCss:
        return applyUpdateCssPatch(tree, patch.selector, patch.styles, allowedCustomProperties);
      case PatchAction.UpdateText:
        return applyUpdateTextPatch(tree, patch.selector, patch.text);
      case PatchAction.InsertHtml:
        return applyInsertHtmlPatch(tree, patch);
      case PatchAction.RemoveElement:
        return applyRemoveElementPatch(tree, patch.selector);
      case PatchAction.SetSectionLayout:
        return applySectionLayoutPatch(tree, patch);
      case PatchAction.ClonePage:
        return applyClonePagePatch(tree, patch);
      default:
        return { ok: false, action: PatchAction.Unknown, message: "Unknown patch action ignored." };
    }
  } catch (error) {
    return {
      ok: false,
      action: "action" in patch ? patch.action : PatchAction.Unknown,
      message: getPatchErrorMessage(patch.action, error)
    };
  }
}

function getPatchErrorMessage(action: PatchAction, error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  return `${action} patch failed.`;
}
