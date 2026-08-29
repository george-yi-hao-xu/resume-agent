import {
	CHAT_ROLE,
	PatchAction,
	type ChatMessage,
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
import { validate_diff_paths_for_resume } from "./path-validation.js";
import { select_llm_provider } from "../providers/select-provider.js";
import type { LlmProviderClient, ModelMessage } from "../providers/types.js";
import {
	extract_json,
	map_provider_usage,
	provider_name_to_enum,
	with_timeout,
} from "../llm-utils.js";
import { run_workflow, type WorkflowStep } from "../workflow.js";

type ResumeDiffState = {
	body: ResumeDiffRequest;
	requestId: string;
	provider: LlmProviderClient;
	temperature: number;
	baseNumPredict: number;
	timeoutMs: number;
	resume: ReturnType<typeof read_resume_from_request>;
	intentClassification?: DiffIntentClassification;
	numPredict: number;
	contextInstruction: string;
	relevantNodes: v_dom_node[];
	resumeContext: string;
	pathIndex: string;
	messages: ModelMessage[];
	rawContent: string;
	model: string;
	usage: LlmUsage;
	diffs: ResumeDiffOp[];
	result?: ResumeDiffResults;
};

type ResumeDiffStep = WorkflowStep<ResumeDiffState>;

export async function run_resume_diff_gen(
	body: ResumeDiffRequest,
	requestId: string,
): Promise<ResumeDiffResults> {
	const provider = select_llm_provider();
	const state: ResumeDiffState = {
		body,
		requestId,
		provider,
		temperature: Number(process.env.LLM_TEMPERATURE ?? 0.1),
		baseNumPredict: Number(process.env.LLM_DIFF_NUM_PREDICT ?? 2048),
		timeoutMs: Number(process.env.LLM_DIFF_TIMEOUT_MS ?? 60000),
		resume: null,
		numPredict: Number(process.env.LLM_DIFF_NUM_PREDICT ?? 2048),
		contextInstruction: "",
		relevantNodes: [],
		resumeContext: "",
		pathIndex: "",
		messages: [],
		rawContent: "",
		model: provider.name,
		usage: {},
		diffs: [],
	};

	const steps: ResumeDiffStep[] = [
		read_resume_step,
		classify_intent_step,
		handle_ambiguous_intent_step,
		build_context_step,
		build_prompt_step,
		call_llm_step,
		parse_and_validate_step,
		build_success_result_step,
	];

	const result = await run_workflow(state, steps, {
		shouldStop: (current) => !!current.result,
	});

	if (!result.state.result) {
		throw new Error("Resume diff workflow finished without a result.");
	}

	return result.state.result;
}

function read_resume_step(state: ResumeDiffState): ResumeDiffState {
	return {
		...state,
		resume: read_resume_from_request(state.body),
	};
}

async function classify_intent_step(
	state: ResumeDiffState,
): Promise<ResumeDiffState> {
	const intentClassification = await classify_diff_intent({
		instruction: state.body.instruction,
		conversationHistory: state.body.conversationHistory,
	});

	const numPredict =
		intentClassification.intent === "page_clone_translate"
			? Math.max(state.baseNumPredict, 4096)
			: state.baseNumPredict;

	return {
		...state,
		intentClassification,
		numPredict,
	};
}

async function handle_ambiguous_intent_step(
	state: ResumeDiffState,
): Promise<ResumeDiffState> {
	const intentClassification = require_intent(state);

	if (
		intentClassification.intent !== "ambiguous" ||
		has_asked_clarification(state.body.conversationHistory)
	) {
		return state;
	}

	await logPatchEvent("resume_diff_ambiguous", {
		requestId: state.requestId,
		instruction: state.body.instruction,
		confidence: intentClassification.confidence,
	});

	return {
		...state,
		result: {
			ok: false,
			diffs: [],
			provider: provider_name_to_enum(state.provider.name),
			model: state.provider.name,
			note: `clar_note: ${intentClassification.guidance}`,
		},
	};
}

function build_context_step(state: ResumeDiffState): ResumeDiffState {
	const intentClassification = require_intent(state);
	const contextInstruction = build_context_instruction(state.body);
	const relevantNodes = build_relevant_nodes(
		state.resume,
		intentClassification,
		contextInstruction,
	);
	const resumeContext = JSON.stringify(relevantNodes);
	const pathIndex = build_node_path_index(relevantNodes);

	return {
		...state,
		contextInstruction,
		relevantNodes,
		resumeContext,
		pathIndex,
	};
}

async function build_prompt_step(
	state: ResumeDiffState,
): Promise<ResumeDiffState> {
	const intentClassification = require_intent(state);
	const messages = build_messages(
		state.body,
		state.resumeContext,
		state.pathIndex,
		intentClassification,
	);

	await logPatchEvent("resume_diff_prompt_ready", {
		requestId: state.requestId,
		intent: intentClassification.intent,
		intentSurfaces: intentClassification.surfaces,
		intentConfidence: intentClassification.confidence,
		intentSource: intentClassification.source,
		intentFallbackReason: intentClassification.fallbackReason,
		contextInstructionChars: state.contextInstruction.length,
		promptChars: messages.reduce(
			(total, message) => total + message.content.length,
			0,
		),
		resumeContextChars: state.resumeContext.length,
		pathIndexChars: state.pathIndex.length,
		includedNodeCount: state.relevantNodes.length,
		numPredict: state.numPredict,
		timeoutMs: state.timeoutMs,
	});

	return {
		...state,
		messages,
	};
}

async function call_llm_step(state: ResumeDiffState): Promise<ResumeDiffState> {
	const llmResult = await with_timeout(
		state.provider.chat(state.messages, {
			temperature: state.temperature,
			maxTokens: state.numPredict,
			format: "json",
		}),
		state.timeoutMs,
		`LLM diff request timed out after ${state.timeoutMs}ms.`,
	);
	const rawContent = llmResult.content;

	await logPatchEvent("resume_diff_llm_raw", {
		requestId: state.requestId,
		rawContent,
	});

	return {
		...state,
		rawContent,
		model: llmResult.model,
		usage: map_provider_usage(llmResult.usage),
	};
}

async function parse_and_validate_step(
	state: ResumeDiffState,
): Promise<ResumeDiffState> {
	const diffs = parse_raw(state.rawContent);
	validate_diff_paths_for_resume(diffs, state.resume);

	await logPatchEvent("resume_diff_llm_finished", {
		requestId: state.requestId,
		diffCount: diffs.length,
		rawContent: state.rawContent,
	});

	return {
		...state,
		diffs,
	};
}

function build_success_result_step(state: ResumeDiffState): ResumeDiffState {
	return {
		...state,
		result: {
			ok: true,
			diffs: state.diffs,
			provider: provider_name_to_enum(state.provider.name),
			model: state.model,
			note: `Generated ${state.diffs.length} resume diff${state.diffs.length === 1 ? "" : "s"}.`,
			usage: state.usage,
		},
	};
}

function require_intent(state: ResumeDiffState): DiffIntentClassification {
	if (!state.intentClassification) {
		throw new Error(
			"Resume diff workflow reached a step before intent classification.",
		);
	}
	return state.intentClassification;
}

function build_context_instruction(body: ResumeDiffRequest): string {
	const recentUserMessages = (body.conversationHistory ?? [])
		.filter((message) => message.role === CHAT_ROLE.USER)
		.slice(-3)
		.map((message) => message.content);

	return [...recentUserMessages, body.instruction].join("\n");
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

function read_diff_op(value: unknown): ResumeDiffOp {
	if (!is_record(value)) {
		throw new Error("Resume diff item must be an object.");
	}

	switch (value.op) {
		case "add":
		case "replace":
		case "test":
			return {
				op: read_value_diff_action(value.op),
				path: validate_json_pointer(value.path),
				value: parse_json_value(value.value),
			};
		case "remove":
			return {
				op: PatchAction.DiffRemove,
				path: validate_json_pointer(value.path),
			};
		case "move":
		case "copy":
			return {
				op: read_from_diff_action(value.op),
				from: validate_json_pointer(value.from),
				path: validate_json_pointer(value.path),
			};
		default:
			throw new Error(`Unsupported resume diff op: ${String(value.op)}`);
	}
}

function read_value_diff_action(
	value: unknown,
): PatchAction.DiffAdd | PatchAction.DiffReplace | PatchAction.DiffTest {
	switch (value) {
		case "add":
			return PatchAction.DiffAdd;
		case "replace":
			return PatchAction.DiffReplace;
		case "test":
			return PatchAction.DiffTest;
		default:
			throw new Error(`Unsupported resume diff op: ${String(value)}`);
	}
}

function read_from_diff_action(
	value: unknown,
): PatchAction.DiffMove | PatchAction.DiffCopy {
	switch (value) {
		case "move":
			return PatchAction.DiffMove;
		case "copy":
			return PatchAction.DiffCopy;
		default:
			throw new Error(`Unsupported resume diff op: ${String(value)}`);
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

function has_asked_clarification(history: ChatMessage[] = []): boolean {
	return history.some((message) => {
		if (message.role !== CHAT_ROLE.ASSISTANT) {
			return false;
		}

		const text = message.content.trim().toLowerCase();
		return text.includes("clar_note");
	});
}

function is_record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
