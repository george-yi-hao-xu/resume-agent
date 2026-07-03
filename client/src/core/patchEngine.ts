// patchEngine.ts

import { PatchAction, type ClonePagePatch, type InsertHtmlPatch, type PatchResult, type ResumeSectionId, type SetSectionLayoutPatch, type UiPatch } from "../types";
import { BLOCKED_TAGS } from "../constants";
import { getAllowedCssCustomProperties } from "./cssCustomProperties";
import { RESUME_SELECTORS } from "./resumeSelectors";

export type PatchEngineOptions = {
  allowedCustomProperties?: string[];
};

const SECTION_SELECTORS: Record<ResumeSectionId, string> = {
  summary: RESUME_SELECTORS.summarySection,
  experience: RESUME_SELECTORS.experienceSection,
  skills: RESUME_SELECTORS.skillsSection,
  projects: RESUME_SELECTORS.projectSection
};

const SECTION_LAYOUT_STYLE_ID = "resume-semantic-layout-styles";

export function applyPatches(doc: Document, patches: UiPatch[], options: PatchEngineOptions = {}): PatchResult[] {
  if (!Array.isArray(patches)) {
    return [{ ok: false, action: PatchAction.Unknown, message: "Patch payload must be an array." }];
  }

  const allowedCustomProperties = new Set(options.allowedCustomProperties ?? getAllowedCssCustomProperties(doc));

  return patches.map((patch) => {
    try {
      switch (patch.action) {
        case PatchAction.UpdateCss:
          return updateCss(doc, patch.selector, patch.styles, allowedCustomProperties);
        case PatchAction.UpdateText:
          return updateText(doc, patch.selector, patch.text);
        case PatchAction.InsertHtml:
          return insertHtml(doc, patch);
        case PatchAction.RemoveElement:
          return removeElement(doc, patch.selector);
        case PatchAction.SetSectionLayout:
          return setSectionLayout(doc, patch);
        case PatchAction.ClonePage:
          return clonePage(doc, patch);
        default:
          return { ok: false, action: PatchAction.Unknown, message: "Unknown patch action ignored." };
      }
    } catch (error) {
      const action = "action" in patch ? patch.action : PatchAction.Unknown;
      return {
        ok: false,
        action,
        message: getPatchErrorMessage(action, error)
      };
    }
  });
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

function updateCss(
  doc: Document,
  selector: string,
  styles: Record<string, string>,
  allowedCustomProperties: Set<string>
): PatchResult {
  const elements = getElements(doc, selector);
  validateCssProperties(styles, allowedCustomProperties);

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

function validateCssProperties(styles: Record<string, string>, allowedCustomProperties: Set<string>): void {
  Object.keys(styles).forEach((property) => {
    const cssProperty = toKebabCase(property);
    if (cssProperty.startsWith("--") && !allowedCustomProperties.has(cssProperty)) {
      throw new Error(`Unsupported CSS custom property: ${cssProperty}`);
    }
  });
}

function updateText(doc: Document, selector: string, text: string): PatchResult {
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
  const parent = doc.querySelector(patch.parent);
  if (!isHtmlInsertionTarget(parent)) {
    const details = getDocumentDebugDetails(doc);
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
  const elements = getElements(doc, selector);
  elements.forEach((element) => element.remove());

  return {
    ok: true,
    action: PatchAction.RemoveElement,
    message: `Removed ${elements.length} element${elements.length === 1 ? "" : "s"}.`
  };
}

function setSectionLayout(doc: Document, patch: SetSectionLayoutPatch): PatchResult {
  if (patch.layout !== "two_column") {
    throw new Error(`Unsupported section layout: ${patch.layout}`);
  }

  const leftSections = getUniqueSectionIds(patch.left, "left");
  const rightSections = getUniqueSectionIds(patch.right, "right");
  const allSectionIds = [...leftSections, ...rightSections];
  if (allSectionIds.length === 0) {
    throw new Error("Section layout requires at least one section.");
  }
  if (new Set(allSectionIds).size !== allSectionIds.length) {
    throw new Error("Section layout cannot place the same section in multiple columns.");
  }

  const sections = allSectionIds.map((sectionId) => getSectionElement(doc, sectionId));
  const resume = doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume);
  if (!resume) {
    throw new Error(`No resume found for selector: ${RESUME_SELECTORS.resume}`);
  }

  ensureSectionLayoutStyles(doc);

  const insertionPoint = sections.reduce<Element | null>((earliest, section) => {
    if (!earliest || (section.compareDocumentPosition(earliest) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      return section;
    }
    return earliest;
  }, null);
  const layoutContainer = doc.createElement("div");
  layoutContainer.className = "resume-section-layout resume-section-layout-two-column";
  layoutContainer.dataset.sectionLayout = "two_column";

  const leftColumn = doc.createElement("div");
  leftColumn.className = "resume-layout-column resume-layout-left";
  leftColumn.dataset.layoutColumn = "left";

  const rightColumn = doc.createElement("div");
  rightColumn.className = "resume-layout-column resume-layout-right";
  rightColumn.dataset.layoutColumn = "right";

  resume.insertBefore(layoutContainer, insertionPoint);

  leftSections.forEach((sectionId) => {
    leftColumn.append(getSectionElement(doc, sectionId));
  });
  rightSections.forEach((sectionId) => {
    rightColumn.append(getSectionElement(doc, sectionId));
  });

  layoutContainer.append(leftColumn, rightColumn);
  removeEmptySectionLayouts(doc);

  return {
    ok: true,
    action: PatchAction.SetSectionLayout,
    message: `Arranged sections into a two-column layout.`
  };
}

function clonePage(doc: Document, patch: ClonePagePatch): PatchResult {
  const source = findResumePage(doc, patch.sourcePage);
  const root = doc.querySelector(RESUME_SELECTORS.root);
  if (!isHtmlInsertionTarget(root)) {
    throw new Error(`No resume root found for selector: ${RESUME_SELECTORS.root}`);
  }

  const targetPageNumber = normalizePageNumber(patch.targetPage);
  const targetId = `page-${targetPageNumber.padStart(2, "0")}`;
  const existingTarget = doc.getElementById(targetId) || doc.querySelector(`[data-resume-page="${targetPageNumber}"]`);

  const clone = source.cloneNode(true) as HTMLElement;
  clone.id = targetId;
  clone.dataset.resumePage = targetPageNumber;
  clone.classList.add("resume");
  sanitizeElementTree(clone);

  if (existingTarget) {
    existingTarget.replaceWith(clone);
  } else {
    root.append(clone);
  }

  return {
    ok: true,
    action: PatchAction.ClonePage,
    message: existingTarget
      ? `Replaced resume page ${targetPageNumber} with a clone of page ${source.dataset.resumePage || patch.sourcePage}.`
      : `Cloned resume page ${source.dataset.resumePage || patch.sourcePage} to page ${targetPageNumber}.`
  };
}

function findResumePage(doc: Document, page: string): HTMLElement {
  const normalized = normalizePageNumber(page);
  const selectors = [
    `#page-${normalized.padStart(2, "0")}`,
    `[data-resume-page="${normalized}"]`,
    page
  ];

  for (const selector of selectors) {
    const element = doc.querySelector<HTMLElement>(selector);
    if (element?.matches(RESUME_SELECTORS.resume)) {
      return element;
    }
  }

  throw new Error(`No resume page found for ${page}.`);
}

function normalizePageNumber(page: string): string {
  const trimmed = page.trim();
  const match = trimmed.match(/\d+/);
  return match ? String(Number(match[0])) : trimmed;
}

function getUniqueSectionIds(sectionIds: ResumeSectionId[], columnName: string): ResumeSectionId[] {
  if (!Array.isArray(sectionIds)) {
    throw new Error(`Section layout ${columnName} column must be an array.`);
  }

  const uniqueIds = [...new Set(sectionIds)];
  uniqueIds.forEach((sectionId) => {
    if (!(sectionId in SECTION_SELECTORS)) {
      throw new Error(`Unknown resume section: ${sectionId}`);
    }
  });
  return uniqueIds;
}

function getSectionElement(doc: Document, sectionId: ResumeSectionId): HTMLElement {
  const selector = SECTION_SELECTORS[sectionId];
  const section = doc.querySelector<HTMLElement>(selector);
  if (!section) {
    throw new Error(`No section found for ${sectionId}.`);
  }
  return section;
}

// Inject the CSS required by semantic section layouts once per preview document.
function ensureSectionLayoutStyles(doc: Document): void {
  if (doc.getElementById(SECTION_LAYOUT_STYLE_ID)) {
    return;
  }

  const style = doc.createElement("style");
  style.id = SECTION_LAYOUT_STYLE_ID;
  style.textContent = `
    .resume-section-layout {
      display: grid;
      gap: 28px;
      padding: 26px 0 0;
    }
    .resume-section-layout-two-column {
      grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
      align-items: start;
    }
    .resume-layout-column {
      display: grid;
      gap: 20px;
      min-width: 0;
    }
    .resume-section-layout .resume-section {
      padding: 0;
    }
    @media (max-width: 720px) {
      .resume-section-layout-two-column {
        grid-template-columns: 1fr;
      }
    }
  `;
  doc.head.append(style);
}

function removeEmptySectionLayouts(doc: Document): void {
  doc.querySelectorAll<HTMLElement>(".resume-section-layout").forEach((layout) => {
    if (!layout.querySelector(".resume-section")) {
      layout.remove();
    }
  });
}

function getElements(doc: Document, selector: string): HTMLElement[] {
  const elements = Array.from(doc.querySelectorAll<HTMLElement>(selector));
  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  return elements;
}

function sanitizeFragment(fragment: DocumentFragment): void {
  fragment.querySelectorAll("*").forEach((node) => {
    sanitizeElement(node);
  });
}

function sanitizeElementTree(element: Element): void {
  sanitizeElement(element);
  element.querySelectorAll("*").forEach((node) => {
    sanitizeElement(node);
  });
}

function sanitizeElement(element: Element): void {
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
}

function toKebabCase(property: string): string {
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function getDocumentDebugDetails(doc: Document): {
  hasResumeRoot: boolean;
  hasSkillsList: boolean;
  url: string;
  bodyClassNames: string[];
  knownSelectorMatches: Record<string, boolean>;
} {
  return {
    hasResumeRoot: !!doc.querySelector(RESUME_SELECTORS.root),
    hasSkillsList: !!doc.querySelector(RESUME_SELECTORS.skillsList),
    url: doc.URL,
    bodyClassNames: Array.from(doc.body?.classList ?? []),
    knownSelectorMatches: Object.fromEntries(
      Object.values(RESUME_SELECTORS).map((selector) => [selector, !!doc.querySelector(selector)])
    )
  };
}

function isHtmlInsertionTarget(value: Element | null): value is HTMLElement {
  return !!value && typeof (value as HTMLElement).insertAdjacentHTML === "function";
}
