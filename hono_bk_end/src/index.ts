import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { config } from "dotenv";
import { resolve } from "node:path";
import {
	type GetPatchesOptions,
	type BackendHealthResponse,
	type PatchResults,
	LlmProvider,
} from "@repo/schema";
import { getLlmHealthResponse } from "./llm/llm-health.js";
import { runPatchGen } from "./llm/patch-generator/run.js";

config({ path: resolve(process.cwd(), "..", ".env") });

const app = new Hono();

app.get("/", (c) => {
	return c.text("Hello World!");
});

app.get("/health", (c) => {
	return c.json({ ok: true } as BackendHealthResponse, 200);
});

app.get("/llm/status", (c) => {
	const model = process.env.OLLAMA_MODEL ?? "";
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";
	return getLlmHealthResponse(chatUrl, model);
});

app.get("/llm/patches", async (c) => {
	const body = await c.req.json<GetPatchesOptions>();
	let result;

	try {
		result = runPatchGen(body) as PatchResults;
	} catch (err) {
    result = {
				ok: false,
				patches: [],
				provider: LlmProvider.Ollama,
				note: err,
			} as PatchResults;
	}

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
