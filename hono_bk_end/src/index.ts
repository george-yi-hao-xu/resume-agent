import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import {
	type GetPatchesOptions,
	type BackendHealthResponse,
	type PatchResults,
	type ResumeDiffRequest,
	type ResumeDiffResults,
	LlmProvider,
} from "@repo/schema";
import { getLlmHealthResponse } from "./llm/llm-health.js";
import { runPatchGen } from "./llm/patch-generator/run.js";
import { runResumeDiffGen } from "./llm/resume-diff-generator/run.js";
import { logPatchEvent } from "./logger.js";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "..", ".env") });

const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b";

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello World!");
});

app.get("/health", (c) => {
	return c.json({ ok: true } as BackendHealthResponse, 200);
});

app.get("/llm/status", (c) => {
	const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";
	return getLlmHealthResponse(chatUrl, model);
});

app.post("/llm/warmup", async (c) => {
	const model = process.env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";

	try {
		const response = await fetch(chatUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				stream: false,
				messages: [{ role: "user", content: "warmup" }],
				options: { temperature: 0 },
			}),
		});

		if (!response.ok) {
			return c.json({ ok: false, message: `Ollama returned ${response.status}.` }, 200);
		}

		return c.json({ ok: true }, 200);
	} catch (error) {
		return c.json({
			ok: false,
			message: error instanceof Error ? error.message : "Ollama warmup failed.",
		}, 200);
	}
});

app.post("/llm/patches", async (c) => {
	const body = await c.req.json<GetPatchesOptions>();
	const requestId = c.req.header("x-request-id") ?? randomUUID();
	let result;

	try {
		await logPatchEvent("start runPatchGen", {
			requestId,
			instruction: body.instruction,
		});
		result = await runPatchGen(body, requestId);
	} catch (err) {
		result = {
			ok: false,
			patches: [],
			provider: LlmProvider.Ollama,
			note: err,
		} as PatchResults;
		await logPatchEvent("runPatchGen err", {
			requestId,
			error: err instanceof Error ? err.message : String(err),
		});
	}

	await logPatchEvent("patch_request_response", {
		requestId,
		ok: result.ok,
		patchCount: result.patches.length,
	});
	return c.json(result, 200);
});

app.post("/llm/resume-diff", async (c) => {
	const body = await c.req.json<ResumeDiffRequest>();
	const requestId = c.req.header("x-request-id") ?? randomUUID();
	let result;

	try {
		await logPatchEvent("start runResumeDiffGen", {
			requestId,
			instruction: body.instruction,
		});
		result = await runResumeDiffGen(body, requestId);
	} catch (err) {
		result = {
			ok: false,
			diffs: [],
			provider: LlmProvider.Ollama,
			note: err instanceof Error ? err.message : String(err),
		} as ResumeDiffResults;
		await logPatchEvent("runResumeDiffGen err", {
			requestId,
			error: err instanceof Error ? err.message : String(err),
		});
	}

	await logPatchEvent("resume_diff_request_response", {
		requestId,
		ok: result.ok,
		diffCount: result.diffs.length,
	});
	return c.json(result, 200);
});

serve(
	{
		fetch: app.fetch,
		port: Number(process.env.SERVER_PORT ?? 3003) ?? 3003,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
