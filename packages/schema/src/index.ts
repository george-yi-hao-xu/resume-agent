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
