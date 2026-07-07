import { RESUME_SELECTORS } from "../resumeSelectors";
import type { Resume } from "../../resume.types";
import {
	PatchAction,
	type PatchResult,
	type ResumeSectionId,
	type SetSectionLayoutPatch,
} from "../../types";
import type { MutableNode, NodeRef } from "./patcher.types";
import {
	comparePaths,
	cloneJson,
	queryNodes,
} from "./utils";

const SECTION_SELECTORS: Record<ResumeSectionId, string> = {
	summary: RESUME_SELECTORS.summarySection,
	experience: RESUME_SELECTORS.experienceSection,
	skills: RESUME_SELECTORS.skillsSection,
	projects: RESUME_SELECTORS.projectSection,
};

const SECTION_LAYOUT_STYLE_ID = "resume-semantic-layout-styles";

export function sectionLayoutPatcher(
	r: Resume,
	patch: SetSectionLayoutPatch,
): PatchResult {
	if (patch.layout !== "two_column") {
		throw new Error(`Unsupported section layout: ${patch.layout}`);
	}

	const leftSections = getUniqueSectionIds(patch.left, "left");
	const rightSections = getUniqueSectionIds(patch.right, "right");
	const allSectionIds = [...leftSections, ...rightSections];
	if (!allSectionIds.length) {
		throw new Error("Section layout requires at least one section.");
	}
	if (new Set(allSectionIds).size !== allSectionIds.length) {
		throw new Error("Section layout cannot place the same section in multiple columns.");
	}

	const resumeRef = queryNodes(r.tree.root, RESUME_SELECTORS.resume)[0];
	if (!resumeRef) {
		throw new Error(`No resume found for selector: ${RESUME_SELECTORS.resume}`);
	}

	const sectionRefs = allSectionIds.map((sectionId) => {
		const selector = SECTION_SELECTORS[sectionId];
		const ref = queryNodes(resumeRef.node, selector)[0];
		if (!ref) {
			throw new Error(`No section found for ${sectionId}.`);
		}
		return ref;
	});

	ensureSectionLayoutStyles(r);
	insertLayoutContainer(r, resumeRef, sectionRefs, leftSections, rightSections, allSectionIds);
	removeEmptySectionLayouts(r);

	return {
		ok: true,
		action: PatchAction.SetSectionLayout,
		message: "Arranged sections into a two-column layout.",
	};
}

function getUniqueSectionIds(
	sectionIds: string[],
	columnName: string,
): ResumeSectionId[] {
	if (!Array.isArray(sectionIds)) {
		throw new Error(`Section layout ${columnName} column must be an array.`);
	}

	const uniqueIds = [...new Set(sectionIds)];
	uniqueIds.forEach((sectionId) => {
		if (!(sectionId in SECTION_SELECTORS)) {
			throw new Error(`Unknown resume section: ${sectionId}`);
		}
	});
	return uniqueIds as ResumeSectionId[];
}

function ensureSectionLayoutStyles(r: Resume): void {
	const headRef = queryNodes(r.tree.root, "head")[0];
	if (!headRef) {
		return;
	}

	if (queryNodes(headRef.node, `#${SECTION_LAYOUT_STYLE_ID}`).length) {
		return;
	}

	headRef.node.children ??= [];
	headRef.node.children.push({
		type: "element",
		tagName: "style",
		attributes: {
			id: SECTION_LAYOUT_STYLE_ID,
		},
		children: [
			{
				type: "text",
				value: `
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
`.trim(),
			},
		],
	} as MutableNode);
}

function insertLayoutContainer(
	r: Resume,
	resumeRef: NodeRef,
	sectionRefs: NodeRef[],
	leftSections: ResumeSectionId[],
	rightSections: ResumeSectionId[],
	allSectionIds: ResumeSectionId[],
): void {
	const earliestSection = sectionRefs
		.slice()
		.sort((left, right) => comparePaths(left.path, right.path))[0];
	const insertionIndex = getDirectChildInsertionIndex(
		resumeRef.node,
		earliestSection.node,
		earliestSection.index,
	);
	const sectionsById = Object.fromEntries(
		allSectionIds.map((sectionId) => [
			sectionId,
			cloneJson(getSectionNode(r, sectionId).node),
		]),
	) as Record<ResumeSectionId, MutableNode>;

	for (const ref of sectionRefs
		.slice()
		.sort((left, right) => comparePaths(right.path, left.path))) {
		ref.parent?.children?.splice(ref.index, 1);
	}

	const layoutContainer: MutableNode = {
		type: "element",
		tagName: "div",
		attributes: {
			class: "resume-section-layout resume-section-layout-two-column",
			"data-section-layout": "two_column",
		},
		children: [],
	};
	const leftColumn: MutableNode = {
		type: "element",
		tagName: "div",
		attributes: {
			class: "resume-layout-column resume-layout-left",
			"data-layout-column": "left",
		},
		children: [],
	};
	const rightColumn: MutableNode = {
		type: "element",
		tagName: "div",
		attributes: {
			class: "resume-layout-column resume-layout-right",
			"data-layout-column": "right",
		},
		children: [],
	};

	for (const sectionId of leftSections) {
		leftColumn.children!.push(cloneJson(sectionsById[sectionId]));
	}
	for (const sectionId of rightSections) {
		rightColumn.children!.push(cloneJson(sectionsById[sectionId]));
	}
	layoutContainer.children!.push(leftColumn, rightColumn);

	resumeRef.node.children ??= [];
	resumeRef.node.children.splice(insertionIndex, 0, layoutContainer);
}

function removeEmptySectionLayouts(r: Resume): void {
	const layoutRefs = queryNodes(r.tree.root, ".resume-section-layout");
	for (const layoutRef of layoutRefs.sort((left, right) =>
		comparePaths(right.path, left.path),
	)) {
		if (!queryNodes(layoutRef.node, ".resume-section").length && layoutRef.parent) {
			layoutRef.parent.children?.splice(layoutRef.index, 1);
		}
	}
}

function getSectionNode(r: Resume, sectionId: ResumeSectionId): NodeRef {
	const selector = SECTION_SELECTORS[sectionId];
	const ref = queryNodes(r.tree.root, selector)[0];
	if (!ref) {
		throw new Error(`No section found for ${sectionId}.`);
	}
	return ref;
}

function getDirectChildInsertionIndex(
	parent: MutableNode,
	child: MutableNode,
	fallbackIndex: number,
): number {
	const children = parent.children ?? [];
	const index = children.findIndex((candidate) => candidate === child);
	return index >= 0 ? index : fallbackIndex;
}
