export type ModelMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

export type LlmCallOptions = {
	temperature?: number;
	maxTokens?: number;
	format?: "json";
};

export type LlmCallResult = {
	content: string;
	model: string;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
		totalDuration?: number;
		loadDuration?: number;
		promptEvalDuration?: number;
		evalDuration?: number;
	};
};

export type LlmProviderClient = {
	name: string;
	chat(
		messages: ModelMessage[],
		options?: LlmCallOptions,
	): Promise<LlmCallResult>;
};
