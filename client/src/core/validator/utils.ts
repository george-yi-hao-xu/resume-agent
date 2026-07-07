import { LlmProvider } from "../../types";

export function isLlmProvider(value: unknown): value is LlmProvider {
	return value === LlmProvider.Ollama || value === LlmProvider.OpenAI;
}
