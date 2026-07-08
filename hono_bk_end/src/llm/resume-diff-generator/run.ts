import {
	LlmProvider,
	type LlmUsage,
	type ResumeDiffOp,
	type ResumeDiffRequest,
	type ResumeDiffResults,
	type ResumeJsonPatchValue,
	type v_dom_node,
} from "@repo/schema";
import { logPatchEvent } from "../../logger.js";
import { read_resume_from_request } from "./code-sheet.js";
import {
	classify_diff_intent,
	type DiffIntentClassification,
} from "./intent-classifier.js";
import { build_relevant_nodes } from "./context-manager/relevant-context.js";

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

export async function run_resume_diff_gen(
	body: ResumeDiffRequest,
	requestId: string,
): Promise<ResumeDiffResults> {
	const model = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
	const chatUrl =
		process.env.OLLAMA_CHAT_URL ?? "http://localhost:11434/api/chat";
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.1);
	const numPredict = Number(process.env.LLM_DIFF_NUM_PREDICT ?? 512);
	const TIMEOUT_MS = Number(process.env.LLM_DIFF_TIMEOUT_MS ?? 60000);
	const resume = read_resume_from_request(body);

	// Guess user intent, style or content?
	const intentClassification = await classify_diff_intent({
		instruction: body.instruction,
		conversationHistory: body.conversationHistory,
		model,
		chatUrl,
	});

	const relevantNodes = build_relevant_nodes(
		resume,
		intentClassification,
		body.instruction,
	);
	const resumeContext = JSON.stringify(relevantNodes);
	const pathIndex = build_node_path_index(relevantNodes);

	const messages = build_messages(
		body,
		resumeContext,
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
		resumeContextChars: resumeContext.length,
		pathIndexChars: pathIndex.length,
		includedNodeCount: relevantNodes.length,
		numPredict,
		timeoutMs: TIMEOUT_MS,
	});

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, TIMEOUT_MS);

	// comm w/ LLM
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

	const usage = parse_ollama_usage(data);
	const diffs = parse_raw(rawContent);

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

function build_messages(
	request: ResumeDiffRequest,
	resumeContext: string,
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

Relevant node path index. Prefer exact paths from this list for existing text and classed nodes:
${pathIndex}

Relevant resume nodes:
${resumeContext}`,
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
Use plain slash paths like /tree/root/children/0/value.
The provided node context is intentionally partial. Do not invent tree paths outside the path index unless copying an existing shown page/container to the next array index.
For text edits, use exact entries from "Text value paths"; do not append /value to a classed element path unless that exact /value path appears in the index.
Use /tree paths for resume content and structure: text, sections, list items, adding/removing/reordering actual resume elements.
When duplicating an existing page, section, item, or translated version, prefer copy from the existing node, then replace the copied text fields.
Use add only for genuinely new content that cannot be copied from an existing structure.
Do not replace large children arrays when a smaller text, node-field, or style diff can satisfy the request.
No markdown, no prose, no HTML snippets.
Do not replace/remove the root object.
Do not create script/style/iframe/object/embed nodes, event attrs, or javascript: URLs.
`.trim();

function build_node_path_index(nodes: v_dom_node[]): string {
	if (!nodes.length) {
		return "No relevant resume nodes were selected.";
	}

	const lines: string[] = [];
	lines.push("Text value paths:");
	for (const node of nodes) {
		collect_text_paths(node, node.wd, lines);
	}
	lines.push("Classed node paths:");
	for (const node of nodes) {
		collect_classed_node_paths(node, node.wd, lines);
	}
	return lines.join("\n");
}

function collect_text_paths(
	node: v_dom_node,
	fallbackWd: string,
	lines: string[],
): void {
	const wd = node.wd || fallbackWd;
	if (node.type === "text") {
		lines.push(`${wd}/value = ${JSON.stringify(node.value ?? "")}`);
		return;
	}

	(node.children ?? []).forEach((child, index) => {
		collect_text_paths(child, `${wd}/children/${index}`, lines);
	});
}

function collect_classed_node_paths(
	node: v_dom_node,
	fallbackWd: string,
	lines: string[],
): void {
	const wd = node.wd || fallbackWd;
	if (node.type === "element") {
		const className = node.attributes?.class;
		if (className) {
			lines.push(
				`${wd} <${node.tagName ?? "element"} class=${JSON.stringify(className)}>`,
			);
		}
	}

	(node.children ?? []).forEach((child, index) => {
		collect_classed_node_paths(child, `${wd}/children/${index}`, lines);
	});
}

function parse_raw(rawOutput: string): ResumeDiffOp[] {
	const jsonText = extract_json(rawOutput);
	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error(
			`Failed to parse resume diff JSON: ${jsonText.slice(0, 80)}`,
		);
	}

	const items = read_diff_items(parsed);

	if (!items) {
		throw new Error(
			`Resume diff output must be diff ops. Raw JSON: ${jsonText.slice(0, 160)}`,
		);
	}

	return items.map(read_diff_op);
}

function read_diff_items(parsed: unknown): unknown[] | null {
	if (Array.isArray(parsed)) {
		return parsed;
	}
	if (!is_record(parsed)) {
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
		if (is_record(value) && typeof value.op === "string") {
			return [value];
		}
	}

	return null;
}

function extract_json(rawOutput: string): string {
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

function read_diff_op(value: unknown): ResumeDiffOp {
	if (!is_record(value)) {
		throw new Error("Resume diff item must be an object.");
	}

	switch (value.op) {
		case "add":
		case "replace":
		case "test":
			return {
				op: value.op,
				path: validate_json_pointer(value.path),
				value: parse_json_value(value.value),
			};
		case "remove":
			return {
				op: "remove",
				path: validate_json_pointer(value.path),
			};
		case "move":
		case "copy":
			return {
				op: value.op,
				from: validate_json_pointer(value.from),
				path: validate_json_pointer(value.path),
			};
		default:
			throw new Error(`Unsupported resume diff op: ${String(value.op)}`);
	}
}

function validate_json_pointer(value: unknown): string {
	const path = String(value ?? "");
	if (!path.startsWith("/") && path !== "") {
		throw new Error(`Invalid JSON pointer path: ${path}`);
	}
	if (path === "") {
		throw new Error("Root edits are not supported.");
	}
	return path;
}

function parse_json_value(value: unknown): ResumeJsonPatchValue {
	if (
		value === null ||
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(parse_json_value);
	}

	if (is_record(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [
				key,
				parse_json_value(item),
			]),
		);
	}

	throw new Error("Diff value must be JSON-serializable.");
}

function parse_ollama_usage(data: OllamaChatResponse): LlmUsage {
	return {
		promptEvalCount: data.prompt_eval_count,
		evalCount: data.eval_count,
		totalDuration: data.total_duration,
		loadDuration: data.load_duration,
		promptEvalDuration: data.prompt_eval_duration,
		evalDuration: data.eval_duration,
	};
}

function is_record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
