// types.ts
export {
	LlmProvider,
	PatchAction,
} from "@repo/schema";
export type {
	ClonePagePatch,
	LlmStatusResponse,
	PatchResult,
	ResumeSectionId,
	SetSectionLayoutPatch,
	UiPatch,
} from "@repo/schema";

export enum PAGE_LAYOUT {
	VERT = "vertical",
	HORI = "horizontal",
}

