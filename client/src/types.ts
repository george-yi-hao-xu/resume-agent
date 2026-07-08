// types.ts
export {
	CHAT_ROLE,
	LlmProvider,
	PatchAction,
} from "@repo/schema";
export type {
	ClonePagePatch,
	LlmStatusResponse,
	PatchResult,
	ResumeDiffOp,
	ResumeDiffResults,
	ResumeDiffRequest,
	ResumeSectionId,
	UiPatch,
} from "@repo/schema";

export enum PAGE_LAYOUT {
	VERT = "vertical",
	HORI = "horizontal",
}
