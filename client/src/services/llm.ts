// llm.ts

import type { ChatMessage, PatchProviderResult } from "../types";

export type LlmStatusResponse =
	| {
			ok: true;
			provider: string;
			model: string;
			message: string;
	}
	| {
			ok: false;
			provider: string;
			model: string;
			reason: "offline" | "model_missing" | "missing_config";
			message: string;
			availableModels?: string[];
	};

export type BackendHealthResponse = {
	ok: boolean;
};

type GetPatchesOptions = {
	instruction: string;
	allowedCssCustomProperties?: string[];
	conversationHistory?: ChatMessage[];
	resumeSummary?: string;
	resumeDom?: string;
	resumeStructure?: string;
};

class LlmApiClient {
	async getPatchesFromInstruction(
		options: GetPatchesOptions,
	): Promise<PatchProviderResult> {
		return this.postJson<PatchProviderResult>("/api/llm/patches", {
			instruction: options.instruction,
			allowedCssCustomProperties:
				options.allowedCssCustomProperties ?? [],
			conversationHistory: options.conversationHistory ?? [],
			resumeSummary:
				options.resumeSummary ?? options.resumeStructure ?? "",
			resumeDom: options.resumeDom ?? "",
		});
	}

	async getStatus(): Promise<LlmStatusResponse> {
		const response = await fetch("/api/llm/status");
		if (!response.ok) {
			throw new Error(
				`LLM status request failed with ${response.status}.`,
			);
		}

		return response.json() as Promise<LlmStatusResponse>;
	}

	async getBackendHealth(): Promise<BackendHealthResponse> {
		const response = await fetch("/api/health");
		if (!response.ok) {
			throw new Error(
				`Backend health request failed with ${response.status}.`,
			);
		}

		return response.json() as Promise<BackendHealthResponse>;
	}

	async warmup(): Promise<boolean> {
		const result = await this.postJson<{ ok: boolean }>(
			"/api/llm/warmup",
			{},
		);
		return result.ok;
	}

	private async postJson<T>(url: string, body: unknown): Promise<T> {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Request-ID": createRequestId(),
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const details = await readErrorDetails(response);
			throw new Error(
				details || `Request failed with ${response.status}.`,
			);
		}

		return response.json() as Promise<T>;
	}
}

export const llm = new LlmApiClient();

function createRequestId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readErrorDetails(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as {
			message?: string;
			error?: string;
		};
		return data.message || data.error || "";
	} catch {
		return "";
	}
}
