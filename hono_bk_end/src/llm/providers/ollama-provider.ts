import type { LlmCallOptions, LlmCallResult, LlmProviderClient, ModelMessage } from "./types.js";

type OllamaChatResponse = {
	message?: { content?: string };
	prompt_eval_count?: number;
	eval_count?: number;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_duration?: number;
	eval_duration?: number;
};

export type OllamaProviderConfig = {
	model?: string;
	chatUrl?: string;
};

export function create_ollama_provider(config?: OllamaProviderConfig): LlmProviderClient {
	const model = config?.model ?? process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
	const chatUrl =
		config?.chatUrl ??
		process.env.OLLAMA_CHAT_URL ??
		"http://localhost:11434/api/chat";

	return {
		name: "ollama",
		async chat(
			messages: ModelMessage[],
			options?: LlmCallOptions,
		): Promise<LlmCallResult> {
			const body: Record<string, unknown> = {
				model,
				stream: false,
				messages,
				options: {
					temperature: options?.temperature ?? 0,
				},
			};
			if (options?.format === "json") {
				body.format = "json";
			}
			if (options?.maxTokens !== undefined) {
				(body.options as Record<string, unknown>).num_predict = options.maxTokens;
			}

			const response = await fetch(chatUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				throw new Error(`Ollama returned ${response.status} from ${chatUrl}.`);
			}

			const data = (await response.json()) as OllamaChatResponse;
			const content = data.message?.content ?? "";
			if (!content.trim()) {
				throw new Error("Ollama returned an empty response.");
			}

			return {
				content,
				model,
				usage: {
					promptTokens: data.prompt_eval_count,
					completionTokens: data.eval_count,
					totalDuration: data.total_duration,
					loadDuration: data.load_duration,
					promptEvalDuration: data.prompt_eval_duration,
					evalDuration: data.eval_duration,
				},
			};
		},
	};
}
