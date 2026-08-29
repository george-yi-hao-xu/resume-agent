import type { RunPatchState } from "./run.js";
import { logPatchEvent } from "../../logger.js";
import { select_llm_provider } from "../providers/select-provider.js";
import type { ModelMessage } from "../providers/types.js";
import { map_provider_usage } from "../llm-utils.js";

export async function feedToLlm(state: RunPatchState): Promise<RunPatchState> {
	const provider = select_llm_provider();
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.1);

	const messages = buildMessages(state);
	const result = await provider.chat(messages, { temperature });
	const rawContent = result.content;

	await logPatchEvent("LLM finishes ", {
		requestId: state.id,
		rawContent: rawContent,
		provider: provider.name,
		model: result.model,
	});

	return {
		...state,
		modelOutput: rawContent,
		modelUsage: map_provider_usage(result.usage),
		providerName: provider.name,
		model: result.model,
		notes: ` ${state.notes} llm`,
	};
}

function buildMessages(state: RunPatchState): ModelMessage[] {
	return [
		{ role: "system", content: state.prompt },
		{ role: "user", content: state.request.instruction },
	];
}
