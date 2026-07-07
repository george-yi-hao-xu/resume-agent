import { makeAutoObservable } from "mobx";
import {
	DEFAULT_OLLAMA_MODEL,
	DEFAULT_OPENAI_MODEL,
	OLLAMA_URL,
} from "../constants";
import { LlmProvider } from "../types";

export type SettingSnapshot = {
	provider?: LlmProvider;
	llmName: string;
	backEndUrl: string;
	temperature: number;
};

export class SettingStore {
	provider = LlmProvider.Ollama;
	llmName = DEFAULT_OLLAMA_MODEL;
	backEndUrl = OLLAMA_URL;
	openAiApiKey = "";
	temperature = 0.1;

	constructor() {
		makeAutoObservable(this);
	}

	updateLlmName(value: string): void {
		this.llmName = value;
	}

	updateProvider(value: LlmProvider): void {
		this.provider = value;
		if (
			value === LlmProvider.OpenAI &&
			this.llmName === DEFAULT_OLLAMA_MODEL
		) {
			this.llmName = DEFAULT_OPENAI_MODEL;
		}
		if (
			value === LlmProvider.Ollama &&
			this.llmName === DEFAULT_OPENAI_MODEL
		) {
			this.llmName = DEFAULT_OLLAMA_MODEL;
		}
	}

	updateBackEndUrl(value: string): void {
		this.backEndUrl = value;
	}

	updateOpenAiApiKey(value: string): void {
		this.openAiApiKey = value.trim();
	}

	updateTemperature(value: number): void {
		this.temperature = Math.min(2, Math.max(0, value));
	}

	getSnapshot(): SettingSnapshot {
		return {
			provider: this.provider,
			llmName: this.llmName,
			backEndUrl: this.backEndUrl,
			temperature: this.temperature,
		};
	}

	loadSnapshot(snapshot: SettingSnapshot): void {
		this.provider = snapshot.provider ?? LlmProvider.Ollama;
		this.llmName = snapshot.llmName;
		this.backEndUrl = snapshot.backEndUrl;
		this.temperature = Math.min(2, Math.max(0, snapshot.temperature));
	}
}
