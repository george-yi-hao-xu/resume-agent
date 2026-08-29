import { LlmProvider, type LlmUsage } from "@repo/schema";

export function provider_name_to_enum(name: string): LlmProvider {
	switch (name.toLowerCase()) {
		case "openai":
			return LlmProvider.OpenAI;
		case "ollama":
		default:
			return LlmProvider.Ollama;
	}
}

export function map_provider_usage(
	usage?: Record<string, number | undefined>,
): LlmUsage {
	return {
		promptEvalCount: usage?.promptTokens,
		evalCount: usage?.completionTokens,
		totalDuration: usage?.totalDuration,
		loadDuration: usage?.loadDuration,
		promptEvalDuration: usage?.promptEvalDuration,
		evalDuration: usage?.evalDuration,
	};
}

export function extract_json(rawOutput: string): string {
	const trimmed = rawOutput.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	const text = fenced ? fenced[1].trim() : trimmed;
	const arrayStart = text.indexOf("[");
	const arrayEnd = text.lastIndexOf("]");
	const objectStart = text.indexOf("{");
	const objectEnd = text.lastIndexOf("}");

	if (
		arrayStart !== -1 &&
		arrayEnd !== -1 &&
		(objectStart === -1 || arrayStart < objectStart)
	) {
		return text.slice(arrayStart, arrayEnd + 1);
	}

	if (objectStart !== -1 && objectEnd !== -1) {
		return text.slice(objectStart, objectEnd + 1);
	}

	throw new Error(`Invalid JSON output: ${rawOutput.slice(0, 80)}`);
}

export function with_timeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => {
			reject(new Error(message));
		}, timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeout) {
			clearTimeout(timeout);
		}
	});
}
