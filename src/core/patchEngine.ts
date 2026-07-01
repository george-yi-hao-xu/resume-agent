import type { InsertHtmlPatch, PatchResult, UiPatch } from "../types";

const BLOCKED_TAGS = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED"]);

export function applyPatches(doc: Document, patches: UiPatch[]): PatchResult[] {
  if (!Array.isArray(patches)) {
    return [{ ok: false, action: "unknown", message: "Patch payload must be an array." }];
  }

  return patches.map((patch) => {
    try {
      switch (patch.action) {
        case "update_css":
          return updateCss(doc, patch.selector, patch.styles);
        case "update_text":
          return updateText(doc, patch.selector, patch.text);
        case "insert_html":
          return insertHtml(doc, patch);
        case "remove_element":
          return removeElement(doc, patch.selector);
        default:
          return { ok: false, action: "unknown", message: "Unknown patch action ignored." };
      }
    } catch (error) {
      return {
        ok: false,
        action: "action" in patch ? patch.action : "unknown",
        message: error instanceof Error ? error.message : "Patch failed."
      };
    }
  });
}

function updateCss(doc: Document, selector: string, styles: Record<string, string>): PatchResult {
  const elements = getElements(doc, selector);
  elements.forEach((element) => {
    Object.entries(styles).forEach(([property, value]) => {
      element.style.setProperty(toKebabCase(property), value);
    });
  });

  return {
    ok: true,
    action: "update_css",
    message: `Updated CSS on ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function updateText(doc: Document, selector: string, text: string): PatchResult {
  const elements = getElements(doc, selector);
  elements.forEach((element) => {
    element.textContent = text;
  });

  return {
    ok: true,
    action: "update_text",
    message: `Updated text on ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function insertHtml(doc: Document, patch: InsertHtmlPatch): PatchResult {
  const parent = doc.querySelector(patch.parent);
  if (!(parent instanceof HTMLElement)) {
    throw new Error(`No parent found for selector: ${patch.parent}`);
  }

  const template = doc.createElement("template");
  template.innerHTML = patch.html;
  sanitizeFragment(template.content);
  parent.insertAdjacentHTML(patch.position ?? "beforeend", template.innerHTML);

  return {
    ok: true,
    action: "insert_html",
    message: `Inserted HTML into ${patch.parent}.`
  };
}

function removeElement(doc: Document, selector: string): PatchResult {
  const elements = getElements(doc, selector);
  elements.forEach((element) => element.remove());

  return {
    ok: true,
    action: "remove_element",
    message: `Removed ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function getElements(doc: Document, selector: string): HTMLElement[] {
  const elements = Array.from(doc.querySelectorAll(selector));
  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  return elements.filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function sanitizeFragment(fragment: DocumentFragment): void {
  fragment.querySelectorAll("*").forEach((node) => {
    if (BLOCKED_TAGS.has(node.tagName)) {
      node.remove();
      return;
    }

    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();

      if (name.startsWith("on") || value.startsWith("javascript:")) {
        node.removeAttribute(attribute.name);
      }
    });
  });
}

function toKebabCase(property: string): string {
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
