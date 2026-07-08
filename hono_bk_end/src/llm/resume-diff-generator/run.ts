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
	readResumeFromRequest,
} from "./code-sheet.js";

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
	const resume = readResumeFromRequest(body);
	const resumeJsonFile = buildResumeJsonFile(resume);
	const messages = buildMessages(body, resumeJsonFile);

	const response = await fetch(chatUrl, {
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

	if (!response.ok) {
		throw new Error(`Ollama returned ${response.status} from ${chatUrl}.`);
	}

	const data = (await response.json()) as OllamaChatResponse;
	const rawContent = data.message?.content ?? "";
	if (!rawContent.trim()) {
		throw new Error("Ollama returned an empty response.");
	}

	const usage = parseOllamaUsage(data);
	const diffs = parseResumeDiffOutput(rawContent);

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

Current resume JSON file:
${resumeJsonFile}`,
		},
		{ role: "user", content: request.instruction },
	];
}

const INTRO = `
You convert a user's resume-editing instruction into JSON Patch-style operations.
Treat the provided resume JSON as a code file. Return where and what to change in that object.

Return ONLY valid JSON. No markdown. No commentary.
Return either a JSON array of diff operations or an object with a "diffs" array.

Supported operations:
1. {"op":"replace","path":"/tree/root/children/0/children/0/children/0/value","value":"New text"}
2. {"op":"replace","path":"/styles/4/attributes/color","value":"#111827"}
3. {"op":"add","path":"/tree/root/children/0/children/-","value":{"type":"element","tagName":"section","attributes":{"class":"resume-section"},"children":[]}}
4. {"op":"remove","path":"/tree/root/children/0/children/2"}
5. {"op":"move","from":"/tree/root/children/0/children/3","path":"/tree/root/children/0/children/1"}
6. {"op":"copy","from":"/tree/root/children/0/children/1","path":"/tree/root/children/0/children/-"}
7. {"op":"test","path":"/tree/doctype","value":"html"}

Use JSON Pointer paths. Escape "~" as "~0" and "/" as "~1" inside path tokens.
Use "-" only as the last array token for add append.
Do not replace or remove the root object.
Do not edit app settings, chat state, or anything outside the provided resume object.
Do not create script, style, iframe, object, or embed DOM nodes.
Do not create event handler attributes such as onclick or javascript: URLs.
`.trim();

function parseResumeDiffOutput(rawOutput: string): ResumeDiffOp[] {
	const jsonText = extractJson(rawOutput);
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error(`Failed to parse resume diff JSON: ${jsonText.slice(0, 80)}`);
	}

	const items = Array.isArray(parsed)
		? parsed
		: isRecord(parsed) && Array.isArray(parsed.diffs)
			? parsed.diffs
			: null;

	if (!items) {
		throw new Error("Resume diff output must be an array or an object with diffs.");
	}

	return items.map(readDiffOp);
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
			Object.entries(value).map(([key, item]) => [key, parseJsonValue(item)]),
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
