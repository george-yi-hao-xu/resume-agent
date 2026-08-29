// types.ts
export { CHAT_ROLE, LlmProvider, PatchAction } from "@repo/schema";
export type {
	LlmStatusResponse,
	PatchResult,
	ResumeDiffOp,
	ResumeDiffResults,
	ResumeDiffRequest,
	ResumeSectionId,
} from "@repo/schema";

export enum PAGE_LAYOUT {
	VERT = "vertical",
	HORI = "horizontal",
}
