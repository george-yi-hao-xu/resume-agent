import type { LlmStatusResponse } from "@repo/schema";

export async function getLlmHealthResponse(
	backEndUrl: string,
	model: string,
): Promise<Response> {
	// no model name setup
	if (!model) {
		return jsonResponse({
			ok: false,
			provider: "ollama",
			model,
			reason: "missing_config",
			message: "OLLAMA_MODEL is required on the server.",
		});
	}

	try {
		const response = await fetch(getOllamaTagsUrl(backEndUrl), {
			method: "GET",
		});

		if (!response.ok) {
			return jsonResponse({
				ok: false,
				provider: "ollama",
				model,
				reason: "offline",
				message: `Ollama returned ${response.status}.`,
			});
		}

		const data = (await response.json()) as {
			models?: Array<{ name?: string; model?: string }>;
		};

		// check if ollama has any llms
		const models = data.models ?? [];
		const availableModels = models
			.map((item) => item.name || item.model)
			.filter((item): item is string => !!item);
		const hasModel = models.some(
			(item) => item.name === model || item.model === model,
		);

		if (!hasModel) {
			return jsonResponse({
				ok: false,
				provider: "ollama",
				model,
				reason: "model_missing",
				message: `Model ${model} was not found.`,
				availableModels,
			});
		}

		return jsonResponse({
			ok: true,
			provider: "ollama",
			model,
			message: `${model} is available.`,
		});
	} catch {
		return jsonResponse({
			ok: false,
			provider: "ollama",
			model,
			reason: "offline",
			message: "Ollama is not reachable.",
		});
	}
}

function jsonResponse(body: LlmStatusResponse): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function getOllamaTagsUrl(backEndUrl: string): string {
	const url = new URL(backEndUrl);
	url.pathname = "/api/tags";
	url.search = "";
	url.hash = "";
	return url.toString();
}
