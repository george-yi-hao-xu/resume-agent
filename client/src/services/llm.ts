// llm.ts

import type {
	BackendHealthResponse,
	GetPatchesOptions,
	LlmStatusResponse,
	PatchResults,
	ResumeDiffRequest,
	ResumeDiffResults,
} from "@repo/schema";
import { createId } from "../core/utils";

class LlmApiClient {
	async getPatchesFromInstruction(
		options: GetPatchesOptions,
	): Promise<PatchResults> {
		return this.postJson<PatchResults>("/api/llm/patches", {
			instruction: options.instruction,
			allowClassNames: options.allowClassNames ?? [],
			conversationHistory: options.conversationHistory ?? [],
			resumeSummary:
				options.resumeSummary ?? options.resumeStructure ?? "",
			resumeDom: options.resumeDom ?? "",
		});
	}

	async getResumeDiffFromInstruction(
		options: ResumeDiffRequest,
	): Promise<ResumeDiffResults> {
		return this.postJson<ResumeDiffResults>("/api/llm/resume-diff", {
			instruction: options.instruction,
			allowClassNames: options.allowClassNames ?? [],
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
		// console.log("Call: ", url, body)
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Request-ID": createId("request"),
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
