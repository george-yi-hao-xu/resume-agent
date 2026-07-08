import {
	PatchAction,
	type LlmUsage,
	type UiPatch,
} from "@repo/schema";
import type { RunPatchState } from "./run.js";
import { logPatchEvent } from "../../logger.js";

type ModelMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

type OllamaChatResponse = {
	message?: { content?: string };
	prompt_eval_count?: number;
	eval_count?: number;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_duration?: number;
	eval_duration?: number;
};

export async function feedToLlm(state: RunPatchState): Promise<RunPatchState> {
	const model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.1);

	const messages = buildMessages(state);
	let response: Response;
	try {
		response = await fetch(chatUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				stream: false,
				messages,
				options: {
					temperature,
				},
			}),
		});
	} catch (error) {
		await logPatchEvent("ollama_fetch_failed", {
			requestId: state.id,
			chatUrl,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	if (!response.ok) {
		throw new Error(`Ollama returned ${response.status} from ${chatUrl}.`);
	}

	const data = (await response.json()) as OllamaChatResponse;
	const rawContent = data.message?.content ?? "";
	if (!rawContent.trim()) {
		throw new Error("Ollama returned an empty response.");
	}

	const usage = parseOllamaUsage(data);

	await logPatchEvent("LLM finishes ", {
		requestId: state.id,
		rawContent: rawContent
	})

	return {
		...state,
		modelOutput: rawContent,
		modelUsage: usage,
		notes: ` ${state.notes} llm`,
	};
}

function buildMessages(state: RunPatchState): ModelMessage[] {
	return [
		{ role: "system", content: state.prompt },
		{ role: "user", content: state.request.instruction },
	];
}

function parseOllamaUsage(data: OllamaChatResponse): LlmUsage {
	return {
		promptEvalCount: data.prompt_eval_count,
		evalCount: data.eval_count,
		totalDuration: data.total_duration,
		loadDuration: data.load_duration,
		promptEvalDuration: data.prompt_eval_duration,
		evalDuration: data.eval_duration,
	};
}
