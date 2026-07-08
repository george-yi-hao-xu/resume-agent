import type { ChatMessage } from "@repo/schema";
import { build_intent_guidance } from "./intent-guidance.js";
import { select_llm_provider } from "../providers/select-provider.js";
import type { ModelMessage } from "../providers/types.js";

export type DiffIntent =
	"visual" | "content" | "mixed" | "page_clone_translate" | "ambiguous";

export type DiffIntentSurface = "styles" | "tree";

export type DiffIntentClassification = {
	intent: DiffIntent;
	surfaces: DiffIntentSurface[];
	confidence: number;
	guidance: string;
	source: "llm" | "fallback";
	fallbackReason?: string;
};

type ClassifyDiffIntentOptions = {
	instruction: string;
	conversationHistory?: ChatMessage[];
	model?: string;
	chatUrl?: string;
	temperature?: number;
	timeoutMs?: number;
};

const INTENTS = new Set<DiffIntent>([
	"visual",
	"content",
	"mixed",
	"page_clone_translate",
	"ambiguous",
]);

const SURFACES = new Set<DiffIntentSurface>(["styles", "tree"]);

export async function classify_diff_intent(
	options: ClassifyDiffIntentOptions,
): Promise<DiffIntentClassification> {
	const provider = select_llm_provider();
	const temperature = options.temperature ?? 0;
	const timeoutMs =
		options.timeoutMs ?? Number(process.env.LLM_INTENT_TIMEOUT_MS ?? 10000);
	const fallback = (): DiffIntentClassification => ({
		intent: "ambiguous",
		surfaces: ["styles", "tree"],
		confidence: 0,
		guidance: build_intent_guidance(options.instruction),
		source: "fallback",
	});

	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			reject(new Error("intent classifier timed out"));
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([
			provider.chat(
				build_classifier_messages(
					options.instruction,
					options.conversationHistory ?? [],
				),
				{
					temperature,
					maxTokens: 192,
					format: "json",
				},
			),
			timeoutPromise,
		]);

		const rawContent = result.content;
		if (!rawContent.trim()) {
			return {
				...fallback(),
				fallbackReason: "intent classifier returned empty content",
			};
		}

		return parse_diff_intent_classification(rawContent);
	} catch (error) {
		return {
			...fallback(),
			fallbackReason:
				error instanceof Error
					? error.message
					: "intent classifier failed",
		};
	}
}

export function parse_diff_intent_classification(
	rawOutput: string,
): DiffIntentClassification {
	const parsed = JSON.parse(extract_json(rawOutput)) as unknown;
	if (!is_record(parsed)) {
		throw new Error("Intent classifier output must be an object.");
	}

	const intent = parse_intent(parsed.intent);
	const surfaces = parse_surfaces(parsed.surfaces);
	const confidence = parse_confidence(parsed.confidence);
	const guidance = parse_guidance(parsed.guidance);

	return {
		intent,
		surfaces,
		confidence,
		guidance,
		source: "llm",
	};
}

function build_classifier_messages(
	instruction: string,
	conversationHistory: ChatMessage[],
): ModelMessage[] {
	const history = conversationHistory
		.slice(-6)
		.map((message) => `${message.role.toUpperCase()}: ${message.content}`)
		.join("\n\n");

	return [
		{
			role: "system",
			content: `You classify resume edit requests for a JSON Patch generator.
Return one JSON object only. Do not generate patches.

Allowed intents:
- visual: presentation-only edits such as layout, spacing, colors, fonts, columns, width, height.
- content: resume text or semantic document structure edits.
- mixed: both content/structure and visual presentation are requested.
- page_clone_translate: request asks for an additional copied/translated page or version.
- ambiguous: intent is unclear.

Allowed surfaces:
- styles: visual presentation under /styles.
- tree: resume content and DOM-like structure under /tree.

Return this exact shape:
{"intent":"visual|content|mixed|page_clone_translate|ambiguous","surfaces":["styles"],"confidence":0.0,"guidance":"one concise instruction for the patch generator"}

Guidance rules:
- visual: tell the generator to prefer small /styles diffs on existing selectors.
- content: tell the generator to prefer precise /tree diffs.
- mixed: tell the generator to use /tree for content/structure and /styles for presentation.
- page_clone_translate: tell the generator to copy the existing page/container first, then replace copied text fields.
- ambiguous: tell the generator to choose the smallest valid diffs and use /styles only for presentation.

Examples (return ONLY the JSON object, no commentary):
Instruction: "make the layout two columns"
{"intent":"visual","surfaces":["styles"],"confidence":0.9,"guidance":"Prefer small /styles diffs on existing container selectors to create a two-column layout."}
Instruction: "change my job title to Senior Engineer"
{"intent":"content","surfaces":["tree"],"confidence":0.95,"guidance":"Use a precise /tree replace op on the job title text path."}
Instruction: "add a second page and translate it to Chinese"
{"intent":"page_clone_translate","surfaces":["tree"],"confidence":0.9,"guidance":"Copy the existing page container to the next array index, then replace copied text fields with Chinese translations."}
Instruction: "make it look better"
{"intent":"ambiguous","surfaces":["styles","tree"],"confidence":0.4,"guidance":"Choose the smallest valid diffs; use /styles only for presentation-only effects and /tree for content or semantic structure."}

Recent chat history:
${history || "(none)"}`,
		},
		{
			role: "user",
			content: `Instruction: ${instruction}`,
		},
	];
}

function extract_json(rawOutput: string): string {
	const trimmed = rawOutput.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	const text = fenced ? fenced[1].trim() : trimmed;
	const objectStart = text.indexOf("{");
	const objectEnd = text.lastIndexOf("}");

	if (objectStart !== -1 && objectEnd !== -1) {
		return text.slice(objectStart, objectEnd + 1);
	}

	throw new Error(
		`Invalid intent classifier output: ${rawOutput.slice(0, 80)}`,
	);
}

function parse_intent(value: unknown): DiffIntent {
	if (typeof value === "string" && INTENTS.has(value as DiffIntent)) {
		return value as DiffIntent;
	}
	throw new Error(`Unsupported diff intent: ${String(value)}`);
}

function parse_surfaces(value: unknown): DiffIntentSurface[] {
	if (!Array.isArray(value)) {
		throw new Error("Intent surfaces must be an array.");
	}

	const surfaces = value.map((item) => {
		if (
			typeof item === "string" &&
			SURFACES.has(item as DiffIntentSurface)
		) {
			return item as DiffIntentSurface;
		}
		throw new Error(`Unsupported intent surface: ${String(item)}`);
	});

	if (surfaces.length === 0) {
		throw new Error("Intent surfaces must not be empty.");
	}

	return Array.from(new Set(surfaces));
}

function parse_confidence(value: unknown): number {
	if (typeof value !== "number" || Number.isNaN(value)) {
		throw new Error("Intent confidence must be a number.");
	}
	return Math.max(0, Math.min(1, value));
}

function parse_guidance(value: unknown): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error("Intent guidance must be a non-empty string.");
	}
	return value.trim();
}

function is_record(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
