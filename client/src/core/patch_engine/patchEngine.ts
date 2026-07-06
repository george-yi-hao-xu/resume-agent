import { RESUME_SELECTORS } from "../resumeSelectors";
import { PatchAction, type PatchResult, type UiPatch } from "../../types";
import type { Resume } from "../../resume.types";
import { cssPatcher } from "./css_patcher";



const BLOCKED_INSERT_TAGS = new Set([
	"script",
	"style",
	"iframe",
	"object",
	"embed",
]);

const SECTION_SELECTORS: Record<
	"summary" | "experience" | "skills" | "projects",
	string
> = {
	summary: RESUME_SELECTORS.summarySection,
	experience: RESUME_SELECTORS.experienceSection,
	skills: RESUME_SELECTORS.skillsSection,
	projects: RESUME_SELECTORS.projectSection,
};

const SECTION_LAYOUT_STYLE_ID = "resume-semantic-layout-styles";

// entry
export function apply(r: Resume, patches: UiPatch[]) {
	const beforeTree = cloneJson(r);
	const nextTree = cloneJson(r);

	if (!Array.isArray(patches)) {
		return {
			new: nextTree,
			results: [
				{
					ok: false,
					action: PatchAction.Unknown,
					message: "Patch payload must be an array.",
				},
			],
			changed: false,
		};
	}

	const results = patches.map((patch) => applyPatch(nextTree, patch));
	const afterTree = cloneJson(nextTree);

	return {
		new: afterTree,
		results,
		changed: JSON.stringify(beforeTree) !== JSON.stringify(afterTree),
	};
}

function applyPatch(tree: Resume, patch: UiPatch): PatchResult {
	try {
		switch (patch.action) {
			case PatchAction.UpdateCss:
				return cssPatcher(tree, patch.selector, patch.styles);
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
				return {
					ok: false,
					action: PatchAction.Unknown,
					message: "Unknown patch action ignored.",
				};
		}
	} catch (error) {
		return {
			ok: false,
			action: "action" in patch ? patch.action : PatchAction.Unknown,
			message: getPatchErrorMessage(patch.action, error),
		};
	}
}

function applyInsertHtmlPatch(
	r: Resume,
	patch: Extract<UiPatch, { action: PatchAction.InsertHtml }>,
): PatchResult {
	const parentRefs = queryNodes(r.tree.root, patch.parent);
	if (!parentRefs.length) {
		return {
			ok: false,
			action: PatchAction.InsertHtml,
			message: `No parent found for selector: ${patch.parent}.`,
		};
	}

	const insertNodes = parseSanitizedHtmlFragment(patch.html);
	if (!insertNodes.length) {
		return {
			ok: true,
			action: PatchAction.InsertHtml,
			message: `Inserted HTML into ${patch.parent}.`,
		};
	}

	const position = patch.position ?? "beforeend";
	for (const parentRef of parentRefs) {
		const clonedNodes = cloneJson(insertNodes);
		insertNodesIntoParent(parentRef, clonedNodes, position);
	}

	return {
		ok: true,
		action: PatchAction.InsertHtml,
		message: `Inserted HTML into ${patch.parent}.`,
	};
}

function applyRemoveElementPatch(r: Resume, selector: string): PatchResult {
	const refs = queryNodes(r.tree.root, selector);
	if (!refs.length) {
		return {
			ok: false,
			action: PatchAction.RemoveElement,
			message: `No elements found for selector: ${selector}`,
		};
	}

	const removable = refs
		.filter((ref) => ref.parent)
		.sort((left, right) => comparePaths(right.path, left.path));

	for (const ref of removable) {
		ref.parent!.children?.splice(ref.index, 1);
	}

	return {
		ok: true,
		action: PatchAction.RemoveElement,
		message: `Removed ${removable.length} element${removable.length === 1 ? "" : "s"}.`,
	};
}

function applySectionLayoutPatch(
	r: Resume,
	patch: Extract<UiPatch, { action: PatchAction.SetSectionLayout }>,
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
		throw new Error(
			"Section layout cannot place the same section in multiple columns.",
		);
	}

	const resumeRef = queryNodes(r.tree.root, RESUME_SELECTORS.resume)[0];
	if (!resumeRef) {
		throw new Error(
			`No resume found for selector: ${RESUME_SELECTORS.resume}`,
		);
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
	insertLayoutContainer(
		r,
		resumeRef,
		sectionRefs,
		leftSections,
		rightSections,
		allSectionIds,
	);
	removeEmptySectionLayouts(r);

	return {
		ok: true,
		action: PatchAction.SetSectionLayout,
		message: "Arranged sections into a two-column layout.",
	};
}

function applyClonePagePatch(
	r: Resume,
	patch: Extract<UiPatch, { action: PatchAction.ClonePage }>,
): PatchResult {
	const sourceId = getPageNodeId(patch.sourcePage);
	const targetId = getPageNodeId(patch.targetPage);
	const sourceRef =
		queryNodes(r.tree.root, `#${sourceId}`)[0] ??
		queryNodes(
			r.tree.root,
			`[data-resume-page="${patch.sourcePage}"]`,
		)[0] ??
		queryNodes(r.tree.root, RESUME_SELECTORS.resume)[0];

	if (!sourceRef) {
		throw new Error(`No source page found for page ${patch.sourcePage}.`);
	}

	const targetRef =
		queryNodes(r.tree.root, `#${targetId}`)[0] ??
		queryNodes(r.tree.root, `[data-resume-page="${patch.targetPage}"]`)[0];

	const clonedPage = cloneJson(sourceRef.node);
	setNodeAttribute(clonedPage, "id", targetId);
	setNodeAttribute(clonedPage, "data-resume-page", patch.targetPage);
	if (patch.targetLanguage) {
		setNodeAttribute(clonedPage, "lang", patch.targetLanguage);
	}

	if (targetRef?.parent) {
		targetRef.parent.children![targetRef.index] = clonedPage;
	} else if (sourceRef.parent) {
		sourceRef.parent.children!.splice(sourceRef.index + 1, 0, clonedPage);
	} else {
		throw new Error("Unable to place cloned page.");
	}

	let appliedTextUpdates = 0;
	let skippedTextUpdates = 0;

	for (const update of patch.textUpdates ?? []) {
		const scopedRefs = queryNodes(clonedPage, update.selector);
		if (!scopedRefs.length) {
			skippedTextUpdates += 1;
			continue;
		}

		for (const ref of scopedRefs) {
			ref.node.children = [
				{
					type: "text",
					value: update.text,
				},
			];
			delete ref.node.value;
		}
		appliedTextUpdates += 1;
	}

	const actionWord = targetRef ? "Replaced" : "Cloned";
	let message = `${actionWord} resume page ${patch.sourcePage} to page ${patch.targetPage}.`;
	if (appliedTextUpdates > 0) {
		message = `${actionWord} resume page ${patch.sourcePage} to page ${patch.targetPage} and applied ${appliedTextUpdates} text update${appliedTextUpdates === 1 ? "" : "s"}.`;
		if (skippedTextUpdates > 0) {
			message = `${message.slice(0, -1)}, skipped ${skippedTextUpdates} missing selector${skippedTextUpdates === 1 ? "" : "s"}.`;
		}
	}

	return {
		ok: true,
		action: PatchAction.ClonePage,
		message,
	};
}

function getUniqueSectionIds(
	sectionIds: string[],
	columnName: string,
): Array<keyof typeof SECTION_SELECTORS> {
	if (!Array.isArray(sectionIds)) {
		throw new Error(
			`Section layout ${columnName} column must be an array.`,
		);
	}

	const uniqueIds = [...new Set(sectionIds)];
	uniqueIds.forEach((sectionId) => {
		if (!(sectionId in SECTION_SELECTORS)) {
			throw new Error(`Unknown resume section: ${sectionId}`);
		}
	});
	return uniqueIds as Array<keyof typeof SECTION_SELECTORS>;
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
	leftSections: Array<keyof typeof SECTION_SELECTORS>,
	rightSections: Array<keyof typeof SECTION_SELECTORS>,
	allSectionIds: Array<keyof typeof SECTION_SELECTORS>,
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
	) as Record<keyof typeof SECTION_SELECTORS, MutableNode>;

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
		if (
			!queryNodes(layoutRef.node, ".resume-section").length &&
			layoutRef.parent
		) {
			layoutRef.parent.children?.splice(layoutRef.index, 1);
		}
	}
}

function getSectionNode(
	r: Resume,
	sectionId: keyof typeof SECTION_SELECTORS,
): NodeRef {
	const selector = SECTION_SELECTORS[sectionId];
	const ref = queryNodes(r.tree.root, selector)[0];
	if (!ref) {
		throw new Error(`No section found for ${sectionId}.`);
	}
	return ref;
}

function insertNodesIntoParent(
	parentRef: NodeRef,
	nodes: MutableNode[],
	position: string,
): void {
	const parent = parentRef.node;
	parent.children ??= [];

	if (position === "beforeend") {
		parent.children.push(...nodes);
		return;
	}

	if (position === "afterbegin") {
		parent.children.unshift(...nodes);
		return;
	}

	if (!parentRef.parent) {
		throw new Error(`No insertion context for selector.`);
	}

	parentRef.parent.children ??= [];
	const parentChildren = parentRef.parent.children;
	const insertIndex =
		position === "afterend" ? parentRef.index + 1 : parentRef.index;
	parentChildren.splice(insertIndex, 0, ...nodes);
}

function parseSanitizedHtmlFragment(html: string): MutableNode[] {
	const template = document.createElement("template");
	template.innerHTML = html;
	const nodes: MutableNode[] = [];

	for (const child of Array.from(template.content.childNodes)) {
		const converted = convertDomNode(child);
		if (converted) {
			nodes.push(...converted);
		}
	}

	return nodes;
}

function convertDomNode(node: ChildNode): MutableNode[] {
	if (node.nodeType === Node.TEXT_NODE) {
		const value = node.textContent ?? "";
		return value ? [{ type: "text", value }] : [];
	}

	if (node.nodeType !== Node.ELEMENT_NODE) {
		return [];
	}

	const element = node as Element;
	const tagName = element.tagName.toLowerCase();
	if (BLOCKED_INSERT_TAGS.has(tagName)) {
		return [];
	}

	const attributes: Record<string, string> = {};
	for (const attr of Array.from(element.attributes)) {
		const name = attr.name;
		const value = attr.value;
		if (name.toLowerCase().startsWith("on")) {
			continue;
		}
		if (/^\s*javascript:/i.test(value)) {
			continue;
		}
		attributes[name] = value;
	}

	const children: MutableNode[] = [];
	for (const child of Array.from(element.childNodes)) {
		const convertedChildren = convertDomNode(child);
		if (convertedChildren.length) {
			children.push(...convertedChildren);
		}
	}

	return [
		{
			type: "element",
			tagName,
			attributes,
			children,
		},
	];
}





function setNodeAttribute(
	node: MutableNode,
	name: string,
	value: string,
): void {
	node.attributes ??= {};
	node.attributes[name] = value;
}

function getPageNodeId(page: string): string {
	const numeric = String(page).trim();
	return `page-${numeric.padStart(2, "0")}`;
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

function comparePaths(left: number[], right: number[]): number {
	const length = Math.min(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		if (left[index] !== right[index]) {
			return left[index] - right[index];
		}
	}
	return left.length - right.length;
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

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
