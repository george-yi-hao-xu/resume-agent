import type { LlmCallOptions, LlmCallResult, LlmProviderClient, ModelMessage } from "./types.js";

type OpenAiChatResponse = {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
	model?: string;
};

export type OpenAiProviderConfig = {
	apiKey?: string;
	model?: string;
	baseUrl?: string;
};

export function create_openai_provider(config?: OpenAiProviderConfig): LlmProviderClient {
	const apiKey = config?.apiKey ?? process.env.OPENAI_API_KEY;
	const model = config?.model ?? process.env.OPENAI_MODEL ?? "gpt-4o";
	const baseUrl =
		config?.baseUrl ??
		process.env.OPENAI_BASE_URL ??
		"https://api.openai.com/v1";

	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not configured.");
	}

	return {
		name: "openai",
		async chat(
			messages: ModelMessage[],
			options?: LlmCallOptions,
		): Promise<LlmCallResult> {
			const body: Record<string, unknown> = {
				model,
				messages,
				temperature: options?.temperature ?? 0,
			};
			if (options?.maxTokens !== undefined) {
				body.max_tokens = options.maxTokens;
			}
			if (options?.format === "json") {
				body.response_format = { type: "json_object" };
			}

			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const text = await response.text();
				throw new Error(
					`OpenAI returned ${response.status}: ${text.slice(0, 200)}`,
				);
			}

			const data = (await response.json()) as OpenAiChatResponse;
			const content = data.choices?.[0]?.message?.content ?? "";
			if (!content.trim()) {
				throw new Error("OpenAI returned an empty response.");
			}

			return {
				content,
				model: data.model ?? model,
				usage: {
					promptTokens: data.usage?.prompt_tokens,
					completionTokens: data.usage?.completion_tokens,
					totalTokens: data.usage?.total_tokens,
				},
			};
		},
	};
}
