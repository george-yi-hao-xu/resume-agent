import { PatchAction, type PatchResult, type ResumeSectionId, type SetSectionLayoutPatch } from "../types";
import { RESUME_SELECTORS } from "./resumeSelectors";
import {
  cloneResumeVNode,
  compareResumeVPaths,
  el,
  getResumeVElementAtPath,
  queryResumeVElement,
  queryResumeVTree,
  removeResumeVElementAtPath,
  sortResumeVRefsForRemoval,
  text,
  type ResumeVElement,
  type ResumeVElementRef,
  type ResumeVTree
} from "./resumeVTree";

const SECTION_SELECTORS: Record<ResumeSectionId, string> = {
  summary: RESUME_SELECTORS.summarySection,
  experience: RESUME_SELECTORS.experienceSection,
  skills: RESUME_SELECTORS.skillsSection,
  projects: RESUME_SELECTORS.projectSection
};

const SECTION_LAYOUT_STYLE_ID = "resume-semantic-layout-styles";

export function applySectionLayoutPatch(tree: ResumeVTree, patch: SetSectionLayoutPatch): PatchResult {
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

  const sectionRefs = allSectionIds.map((sectionId) => getSectionElement(tree, sectionId));
  const resume = queryResumeVTree(tree, RESUME_SELECTORS.resume)[0];
  if (!resume) {
    throw new Error(`No resume found for selector: ${RESUME_SELECTORS.resume}`);
  }

  ensureSectionLayoutStyles(tree);
  insertLayoutContainer(tree, resume, sectionRefs, leftSections, rightSections, allSectionIds);
  removeEmptySectionLayouts(tree);

  return {
    ok: true,
    action: PatchAction.SetSectionLayout,
    message: "Arranged sections into a two-column layout."
  };
}

function insertLayoutContainer(
  tree: ResumeVTree,
  resume: ResumeVElementRef,
  sectionRefs: ResumeVElementRef[],
  leftSections: ResumeSectionId[],
  rightSections: ResumeSectionId[],
  allSectionIds: ResumeSectionId[]
): void {
  const earliestSection = sectionRefs.slice().sort((left, right) => compareResumeVPaths(left.path, right.path))[0];
  const insertionIndex = getDirectChildInsertionIndex(resume.node, earliestSection.node);
  const sectionsById = Object.fromEntries(
    allSectionIds.map((sectionId) => [sectionId, cloneResumeVNode(getSectionElement(tree, sectionId).node)])
  ) as Record<ResumeSectionId, ResumeVElement>;

  sortResumeVRefsForRemoval(sectionRefs).forEach(({ path }) => {
    removeResumeVElementAtPath(tree, path);
  });

  const layoutContainer = el("div", {
    class: "resume-section-layout resume-section-layout-two-column",
    "data-section-layout": "two_column"
  });
  const leftColumn = el("div", {
    class: "resume-layout-column resume-layout-left",
    "data-layout-column": "left"
  });
  const rightColumn = el("div", {
    class: "resume-layout-column resume-layout-right",
    "data-layout-column": "right"
  });

  leftSections.forEach((sectionId) => {
    leftColumn.children.push(sectionsById[sectionId]);
  });
  rightSections.forEach((sectionId) => {
    rightColumn.children.push(sectionsById[sectionId]);
  });
  layoutContainer.children.push(leftColumn, rightColumn);

  const currentResume = getResumeVElementAtPath(tree, resume.path);
  if (currentResume) {
    currentResume.children.splice(Math.min(insertionIndex, currentResume.children.length), 0, layoutContainer);
  }
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

function getSectionElement(tree: ResumeVTree, sectionId: ResumeSectionId): ResumeVElementRef {
  const selector = SECTION_SELECTORS[sectionId];
  const section = queryResumeVTree(tree, selector)[0];
  if (!section) {
    throw new Error(`No section found for ${sectionId}.`);
  }
  return section;
}

function ensureSectionLayoutStyles(tree: ResumeVTree): void {
  if (queryResumeVTree(tree, `#${SECTION_LAYOUT_STYLE_ID}`).length) {
    return;
  }

  const style = el("style", { id: SECTION_LAYOUT_STYLE_ID }, [
    text(`
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
  `)
  ]);

  const head = queryResumeVTree(tree, "head")[0]?.node;
  if (head) {
    head.children.push(style);
  }
}

function removeEmptySectionLayouts(tree: ResumeVTree): void {
  sortResumeVRefsForRemoval(queryResumeVTree(tree, ".resume-section-layout"))
    .forEach((layout) => {
      if (!queryResumeVElement(layout.node, ".resume-section").length) {
        removeResumeVElementAtPath(tree, layout.path);
      }
    });
}

function getDirectChildInsertionIndex(parent: ResumeVElement, child: ResumeVElement): number {
  const index = parent.children.findIndex((candidate) => candidate === child);
  return index >= 0 ? index : parent.children.length;
}
