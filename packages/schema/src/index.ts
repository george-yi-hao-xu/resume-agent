export * from "./resume.types.js";
export { PATCH_TYPES, RESUME_TYPES } from "./str.js";

export type BackendHealthResponse = {
	ok: boolean;
};

export type LlmStatusResponse =
	| {
			ok: true;
			provider: string;
			model: string;
			message: string;
	  }
	| {
			ok: false;
			provider: string;
			model: string;
			reason: "offline" | "model_missing" | "missing_config";
			message: string;
			availableModels?: string[];
	  };

export enum LlmProvider {
	Ollama = "ollama",
	OpenAI = "openai",
}

export type ResumeSectionId = "summary" | "experience" | "skills" | "projects";

export type PatchResult = {
	ok: boolean;
	action: PatchAction;
	message: string;
};

export type LlmUsage = {
	promptEvalCount?: number;
	evalCount?: number;
	totalDuration?: number;
	loadDuration?: number;
	promptEvalDuration?: number;
	evalDuration?: number;
};

// Edit operations
export enum PatchAction {
	DiffAdd = "add",
	DiffRemove = "remove",
	DiffReplace = "replace",
	DiffMove = "move",
	DiffCopy = "copy",
	DiffTest = "test",
	Unknown = "unknown_patch_action",
	// Preview = "preview",
	// Ollama = "ollama",
}

// LLM resume diff request/response
export type ResumeDiffRequest = {
	instruction: string;
	allowClassNames?: string[];
	conversationHistory?: ChatMessage[];
	resumeSummary?: string;
	resumeDom?: string;
	resumeStructure?: string;
};

export type ResumeJsonPatchValue =
	| null
	| boolean
	| number
	| string
	| ResumeJsonPatchValue[]
	| { [key: string]: ResumeJsonPatchValue };

export type ResumeJsonPatchOp =
	| {
			op:
				| PatchAction.DiffAdd
				| PatchAction.DiffReplace
				| PatchAction.DiffTest;
			path: string;
			value: ResumeJsonPatchValue;
	  }
	| {
			op: PatchAction.DiffRemove;
			path: string;
	  }
	| {
			op: PatchAction.DiffMove | PatchAction.DiffCopy;
			from: string;
			path: string;
	  };

export type ResumeDiffOp = ResumeJsonPatchOp;

export type ResumeDiffResults = {
	ok: boolean;
	diffs: ResumeDiffOp[];
	provider: LlmProvider;
	model?: string;
	note?: string;
	usage?: LlmUsage;
};

export enum CHAT_ROLE {
	USER = "user",
	ASSISTANT = "assistant",
	SYSTEM = "system",
}

export type ChatMessage = {
	id: string;
	role: CHAT_ROLE;
	content: string;
	diffs?: ResumeDiffOp[];
	provider?: LlmProvider;
	usage?: LlmUsage;
};
