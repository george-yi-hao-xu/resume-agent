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

export type SetSectionLayoutPatch = {
	action: PatchAction.SetSectionLayout;
	layout: "two_column";
	left: ResumeSectionId[];
	right: ResumeSectionId[];
};

export type ClonePagePatch = {
	action: PatchAction.ClonePage;
	sourcePage: string;
	targetPage: string;
	targetLanguage?: string;
	textUpdates?: Array<{
		selector: string;
		text: string;
	}>;
};

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
export enum PatchAction {
	UpdateCss = "update_css",
	UpdateText = "update_text",
	InsertHtml = "insert_html",
	RemoveElement = "remove_element",
	SetSectionLayout = "set_section_layout",
	ClonePage = "clone_page",
	Unknown = "unknown",
	Preview = "preview",
	Ollama = "ollama",
}

export type UpdateCssPatch = {
	action: PatchAction.UpdateCss;
	selector: string;
	styles: Record<string, string>;
};

export type UpdateTextPatch = {
	action: PatchAction.UpdateText;
	selector: string;
	text: string;
};

export type InsertHtmlPatch = {
	action: PatchAction.InsertHtml;
	parent: string;
	position?: InsertPosition;
	html: string;
};

export type RemoveElementPatch = {
	action: PatchAction.RemoveElement;
	selector: string;
};
export type UiPatch =
	| UpdateCssPatch
	| UpdateTextPatch
	| InsertHtmlPatch
	| RemoveElementPatch
	| SetSectionLayoutPatch
	| ClonePagePatch;


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
	allowedCssCustomProperties?: string[];
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
