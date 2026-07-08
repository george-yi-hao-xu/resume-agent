import type { LlmProviderClient } from "./types.js";
import { create_ollama_provider } from "./ollama-provider.js";
import { create_openai_provider } from "./openai-provider.js";

export function select_llm_provider(): LlmProviderClient {
	const preferred = process.env.LLM_PROVIDER?.toLowerCase();

	if (preferred === "openai" || process.env.OPENAI_API_KEY) {
		try {
			return create_openai_provider();
		} catch {
			if (preferred === "openai") {
				throw new Error(
					"LLM_PROVIDER=openai is set but OPENAI_API_KEY is missing.",
				);
			}
		}
	}

	return create_ollama_provider();
}
