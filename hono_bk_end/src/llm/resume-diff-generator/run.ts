import {
	LlmProvider,
	type LlmUsage,
	type ResumeDiffOp,
	type ResumeDiffRequest,
	type ResumeDiffResults,
	type ResumeJsonPatchValue,
} from "@repo/schema";
import { logPatchEvent } from "../../logger.js";
import {
	buildResumeJsonFile,
	buildResumePathIndex,
	readResumeFromRequest,
} from "./code-sheet.js";
import {
	classifyDiffIntent,
	type DiffIntentClassification,
} from "./intent-classifier.js";

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

export async function runResumeDiffGen(
	body: ResumeDiffRequest,
	requestId: string,
): Promise<ResumeDiffResults> {
	const model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.1);
	const numPredict = Number(process.env.LLM_DIFF_NUM_PREDICT ?? 512);
	const TIMEOUT_MS = Number(process.env.LLM_DIFF_TIMEOUT_MS ?? 60000);
	const resume = readResumeFromRequest(body);
	const resumeJsonFile = buildResumeJsonFile(resume);
	const pathIndex = buildResumePathIndex(resume);
	const intentClassification = await classifyDiffIntent({
		instruction: body.instruction,
		conversationHistory: body.conversationHistory,
		model,
		chatUrl,
	});
	const messages = buildMessages(
		body,
		resumeJsonFile,
		pathIndex,
		intentClassification,
	);

	await logPatchEvent("resume_diff_prompt_ready", {
		requestId,
		intent: intentClassification.intent,
		intentSurfaces: intentClassification.surfaces,
		intentConfidence: intentClassification.confidence,
		intentSource: intentClassification.source,
		intentFallbackReason: intentClassification.fallbackReason,
		promptChars: messages.reduce(
			(total, message) => total + message.content.length,
			0,
		),
		resumeChars: resumeJsonFile.length,
		pathIndexChars: pathIndex.length,
		numPredict,
		timeoutMs: TIMEOUT_MS,
	});

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(chatUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			signal: abortController.signal,
			body: JSON.stringify({
				model,
				stream: false,
				format: "json",
				messages,
				options: {
					temperature,
					num_predict: numPredict,
				},
			}),
		});
	} catch (error) {
		if (abortController.signal.aborted) {
			throw new Error(
				`Ollama diff request timed out after ${TIMEOUT_MS}ms.`,
			);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}

	if (!response.ok) {
		throw new Error(`Ollama returned ${response.status} from ${chatUrl}.`);
	}

	const data = (await response.json()) as OllamaChatResponse;
	const rawContent = data.message?.content ?? "";
	if (!rawContent.trim()) {
		throw new Error("Ollama returned an empty response.");
	}

	await logPatchEvent("resume_diff_llm_raw", {
		requestId,
		rawContent,
	});

	const usage = parseOllamaUsage(data);
	const diffs = parseRaw(rawContent);

	await logPatchEvent("resume_diff_llm_finished", {
		requestId,
		diffCount: diffs.length,
		rawContent,
	});

	return {
		ok: true,
		diffs,
		provider: LlmProvider.Ollama,
		model,
		note: `Generated ${diffs.length} resume diff${diffs.length === 1 ? "" : "s"}.`,
		usage,
	};
}

function buildMessages(
	request: ResumeDiffRequest,
	resumeJsonFile: string,
	pathIndex: string,
	intentClassification: DiffIntentClassification,
): ModelMessage[] {
	const history = (request.conversationHistory ?? [])
		.slice(-6)
		.map((message) => `${message.role.toUpperCase()}: ${message.content}`)
		.join("\n\n");

	return [
		{
			role: "system",
			content: `${INTRO}

Allowed class names: ${(request.allowClassNames ?? []).join(", ")}

Recent chat history:
${history || "(none)"}

Intent guidance for this request:
Intent: ${intentClassification.intent}
Surfaces: ${intentClassification.surfaces.join(", ")}
Confidence: ${intentClassification.confidence}
${intentClassification.guidance}

Path index. Prefer exact paths from this list for existing text, classed nodes, and styles:
${pathIndex}

Current resume JSON file:
${resumeJsonFile}`,
		},
		{
			role: "user",
			content: `Instruction: ${request.instruction}

Return only this JSON object shape:
{"diffs":[{"op":"replace","path":"/tree/root/.../value","value":"..."}]}`,
		},
	];
}

const INTRO = `
You are a JSON patch generator. You must return one JSON object only:
{"diffs":[...]}

Each item in diffs is a JSON Patch operation for the provided Resume object.
Allowed ops: add, remove, replace, move, copy, test.
Use exact paths from the path index when possible.
Use plain slash paths like /tree/root/children/0/value or /styles/4/attributes/color.
Styles and tree are both valid edit surfaces. Choose the surface that matches the user's intent.
For text edits, use exact entries from "Text value paths"; do not append /value to a classed element path unless that exact /value path appears in the index.
Use /styles paths for visual presentation: layout, grid, columns, flex, spacing, width, height, margin, padding, color, and typography.
Use /tree paths for resume content and structure: text, sections, list items, adding/removing/reordering actual resume elements.
When duplicating an existing page, section, item, or translated version, prefer copy from the existing node, then replace the copied text fields.
Use add only for genuinely new content that cannot be copied from an existing structure.
Do not replace large children arrays when a smaller text, node-field, or style diff can satisfy the request.
No markdown, no prose, no HTML snippets.
Do not replace/remove the root object.
Do not create script/style/iframe/object/embed nodes, event attrs, or javascript: URLs.
`.trim();

function parseRaw(rawOutput: string): ResumeDiffOp[] {
	const jsonText = extractJson(rawOutput);
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error(
			`Failed to parse resume diff JSON: ${jsonText.slice(0, 80)}`,
		);
	}

	const items = readDiffItems(parsed);

	if (!items) {
		throw new Error(
			`Resume diff output must be diff ops. Raw JSON: ${jsonText.slice(0, 160)}`,
		);
	}

	return items.map(readDiffOp);
}

function readDiffItems(parsed: unknown): unknown[] | null {
	if (Array.isArray(parsed)) {
		return parsed;
	}
	if (!isRecord(parsed)) {
		return null;
	}
	if (typeof parsed.op === "string") {
		return [parsed];
	}

	for (const key of [
		"diffs",
		"diff",
		"operations",
		"operation",
		"ops",
		"patches",
		"patch",
		"changes",
	]) {
		const value = parsed[key];
		if (Array.isArray(value)) {
			return value;
		}
		if (isRecord(value) && typeof value.op === "string") {
			return [value];
		}
	}

	return null;
}

function extractJson(rawOutput: string): string {
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

	throw new Error(`Invalid resume diff output: ${rawOutput.slice(0, 80)}`);
}

function readDiffOp(value: unknown): ResumeDiffOp {
	if (!isRecord(value)) {
		throw new Error("Resume diff item must be an object.");
	}

	switch (value.op) {
		case "add":
		case "replace":
		case "test":
			return {
				op: value.op,
				path: validateJsonPointer(value.path),
				value: parseJsonValue(value.value),
			};
		case "remove":
			return {
				op: "remove",
				path: validateJsonPointer(value.path),
			};
		case "move":
		case "copy":
			return {
				op: value.op,
				from: validateJsonPointer(value.from),
				path: validateJsonPointer(value.path),
			};
		default:
			throw new Error(`Unsupported resume diff op: ${String(value.op)}`);
	}
}

function validateJsonPointer(value: unknown): string {
	const path = String(value ?? "");
	if (!path.startsWith("/") && path !== "") {
		throw new Error(`Invalid JSON pointer path: ${path}`);
	}
	if (path === "") {
		throw new Error("Root edits are not supported.");
	}
	return path;
}

function parseJsonValue(value: unknown): ResumeJsonPatchValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(parseJsonValue);
	}

	if (isRecord(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				parseJsonValue(item),
			]),
		);
	}

	throw new Error("Diff value must be JSON-serializable.");
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
