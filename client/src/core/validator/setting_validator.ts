// check if valid for restorring the settings in setting store
import { isRecord } from "../utils";
import type { SettingSnapshot } from "../../stores/SettingStore";
import { LlmProvider } from "../../types";
import { isLlmProvider } from "./utils";


export function parseSettingSnapshot(value: unknown) {
	if (
		!isRecord(value) ||
		typeof value.llmName !== "string" ||
		typeof value.backEndUrl !== "string" ||
		typeof value.temperature !== "number" ||
		!Number.isFinite(value.temperature) ||
		(value.provider !== undefined && !isLlmProvider(value.provider))
	) {
		return {
            provider: LlmProvider.Ollama,
            llmName: '',
            backEndUrl: '',
            temperature: 0.1
        } as SettingSnapshot;
	}

	return {
		provider: value.provider,
		llmName: value.llmName,
		backEndUrl: value.backEndUrl,
		temperature: value.temperature,
	} as SettingSnapshot;
}