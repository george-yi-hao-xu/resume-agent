import { PatchAction, type InsertHtmlPatch, type PatchResult, type UiPatch } from "../types";

const BLOCKED_TAGS = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED"]);

export function applyPatches(doc: Document, patches: UiPatch[]): PatchResult[] {
  console.log("[patchEngine.applyPatches]", { patchCount: Array.isArray(patches) ? patches.length : "invalid", patches });
  if (!Array.isArray(patches)) {
    return [{ ok: false, action: PatchAction.Unknown, message: "Patch payload must be an array." }];
  }

  return patches.map((patch) => {
    console.log("[patchEngine.applyPatches:patch]", patch);
    try {
      switch (patch.action) {
        case PatchAction.UpdateCss:
          return updateCss(doc, patch.selector, patch.styles);
        case PatchAction.UpdateText:
          return updateText(doc, patch.selector, patch.text);
        case PatchAction.InsertHtml:
          return insertHtml(doc, patch);
        case PatchAction.RemoveElement:
          return removeElement(doc, patch.selector);
        default:
          return { ok: false, action: PatchAction.Unknown, message: "Unknown patch action ignored." };
      }
    } catch (error) {
      console.log("[patchEngine.applyPatches:error]", { patch, error });
      return {
        ok: false,
        action: "action" in patch ? patch.action : PatchAction.Unknown,
        message: error instanceof Error ? error.message : "Patch failed."
      };
    }
  });
}

function updateCss(doc: Document, selector: string, styles: Record<string, string>): PatchResult {
  console.log("[patchEngine.updateCss]", { selector, styles });
  const elements = getElements(doc, selector);
  elements.forEach((element) => {
    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(toKebabCase(property), value);
    });
  });

  return {
    ok: true,
    action: PatchAction.UpdateCss,
    message: `Updated CSS on ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function updateText(doc: Document, selector: string, text: string): PatchResult {
  console.log("[patchEngine.updateText]", { selector, text });
  const elements = getElements(doc, selector);
  elements.forEach((element) => {
    element.textContent = text;
  });

  return {
    ok: true,
    action: PatchAction.UpdateText,
    message: `Updated text on ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function insertHtml(doc: Document, patch: InsertHtmlPatch): PatchResult {
  console.log("[patchEngine.insertHtml]", patch);
  const parent = doc.querySelector(patch.parent);
  if (!isHtmlInsertionTarget(parent)) {
    const details = getDocumentDebugDetails(doc);
    console.log("[patchEngine.insertHtml:missingParent]", {
      parent: patch.parent,
      ...details
    });
    throw new Error(
      `No parent found for selector: ${patch.parent}. Resume loaded: ${details.hasResumeRoot}. Skills list present: ${details.hasSkillsList}.`
    );
  }

  const template = doc.createElement("template");
  template.innerHTML = patch.html;
  sanitizeFragment(template.content);
  parent.insertAdjacentHTML(patch.position ?? "beforeend", template.innerHTML);

  return {
    ok: true,
    action: PatchAction.InsertHtml,
    message: `Inserted HTML into ${patch.parent}.`
  };
}

function removeElement(doc: Document, selector: string): PatchResult {
  console.log("[patchEngine.removeElement]", { selector });
  const elements = getElements(doc, selector);
  elements.forEach((element) => element.remove());

  return {
    ok: true,
    action: PatchAction.RemoveElement,
    message: `Removed ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function getElements(doc: Document, selector: string): HTMLElement[] {
  console.log("[patchEngine.getElements]", { selector });
  const elements = Array.from(doc.querySelectorAll<HTMLElement>(selector));
  console.log("[patchEngine.getElements:result]", { selector, count: elements.length });
  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  return elements;
}

function sanitizeFragment(fragment: DocumentFragment): void {
  console.log("[patchEngine.sanitizeFragment]");
  fragment.querySelectorAll("*").forEach((node) => {
    if (BLOCKED_TAGS.has(node.tagName)) {
      console.log("[patchEngine.sanitizeFragment:removeBlockedTag]", { tagName: node.tagName });
      node.remove();
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (name.startsWith("on") || value.startsWith("javascript:")) {
        console.log("[patchEngine.sanitizeFragment:removeAttribute]", { tagName: node.tagName, attribute: attribute.name });
        node.removeAttribute(attribute.name);
      }
    });
  });
}

function toKebabCase(property: string): string {
  console.log("[patchEngine.toKebabCase]", { property });
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function getDocumentDebugDetails(doc: Document): {
  hasResumeRoot: boolean;
  hasSkillsList: boolean;
  url: string;
  bodyClassNames: string[];
  knownSelectorMatches: Record<string, boolean>;
} {
  console.log("[patchEngine.getDocumentDebugDetails]");
  const knownSelectors = [
    "[data-resume-root]",
    ".resume",
    ".resume-name",
    ".resume-title",
    ".summary-text",
    ".experience-list",
    ".skills-list",
    ".project-list"
  ];

  return {
    hasResumeRoot: !!doc.querySelector("[data-resume-root]"),
    hasSkillsList: !!doc.querySelector(".skills-list"),
    url: doc.URL,
    bodyClassNames: Array.from(doc.body?.classList ?? []),
    knownSelectorMatches: Object.fromEntries(
      knownSelectors.map((selector) => [selector, !!doc.querySelector(selector)])
    )
  };
}

function isHtmlInsertionTarget(value: Element | null): value is HTMLElement {
  console.log("[patchEngine.isHtmlInsertionTarget]", { hasValue: !!value, tagName: value?.tagName });
  return !!value && typeof (value as HTMLElement).insertAdjacentHTML === "function";
}
