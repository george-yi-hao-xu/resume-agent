export * from './resume.types.js'
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

// Patches
export enum PatchAction {
	UpdateCss = "update_css",
	UpdateText = "update_text",
	UpdateElementAttr = "update_element_attr",
	InsertElement = "insert_element",
	RemoveElement = "remove_element",
	CloneElement = "clone_element",
	Unknown = "unknown_patch_action",
	// Preview = "preview",
	// Ollama = "ollama",
}

export type UpdateCssPatch = {
	action: PatchAction.UpdateCss;
	selector: string;
	styles: Record<string, string>;
};

export type UpdateTextPatch = {
	action: PatchAction.UpdateText;
	selector: string;
	from: string;
	to: string;
};

export type UpdateElementAttrPatch = {
	action: PatchAction.UpdateElementAttr;
	selector: string;
	attr: string,
	value: string,
}

export type InsertElementPatch = {
	action: PatchAction.InsertElement;
	parent: string;
	position?: InsertPosition;
	html: string;
};

export type RemoveElementPatch = {
	action: PatchAction.RemoveElement;
	selector: string;
};

export type CloneElementPatch = {
	action: PatchAction.CloneElement,
	source: string,
	parent: string,
	position?: InsertPosition
}

export type ClonePagePatch = {
	action: PatchAction.CloneElement;
	sourcePage: string;
	targetPage: string;
	targetLanguage?: string;
	textUpdates?: Array<{
		selector: string;
		text: string;
	}>;
};

// valid patches
export type UiPatch =
	| UpdateCssPatch
	| UpdateTextPatch
	| UpdateElementAttrPatch
	| InsertElementPatch
	| RemoveElementPatch
	| CloneElementPatch
	| ClonePagePatch;


// stuff return back to web front end
export type PatchResults = {
	ok: boolean;
	patches: UiPatch[];
	provider: LlmProvider;
	model?: string;
	note?: string;
	usage?: LlmUsage;
};

export type GetPatchesOptions = {
	instruction: string;
	allowClassNames?: string[];
	conversationHistory?: ChatMessage[];
	resumeSummary?: string;
	resumeDom?: string;
	resumeStructure?: string;
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
	patches?: UiPatch[];
	provider?: PatchResults["provider"];
	usage?: LlmUsage;
};
