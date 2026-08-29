import {
	LlmProvider,
	PatchAction,
	type GetPatchesOptions,
	type LlmUsage,
	type PatchResults,
	type UiPatch,
} from "@repo/schema";
import { logPatchEvent } from "../../logger.js";
import { select_llm_provider } from "../providers/select-provider.js";

type LayoutPlan = {
	layout?: "single_column" | "two_column" | "sidebar";
	density?: "compact" | "balanced" | "spacious";
	tone?: "classic" | "modern" | "editorial" | "executive";
	emphasis?: "content" | "sections" | "header" | "skills";
	accent?: "blue" | "green" | "purple" | "slate";
};

const LAYOUT_TERMS =
	/(layout|排版|版式|two[- ]?column|两列|双栏|sidebar|侧栏|compact|紧凑|spacing|间距|modern|现代|premium|高级|executive|senior|visual|designer|设计感|typography|字体|hierarchy|层级)/i;

export async function tryRunLayoutPlan(
	body: GetPatchesOptions,
	requestId: string,
): Promise<PatchResults | null> {
	if (!LAYOUT_TERMS.test(body.instruction)) {
		return null;
	}

	const provider = select_llm_provider();
	const temperature = Number(process.env.LLM_TEMPERATURE ?? 0.1);
	let plan = fallback_plan(body.instruction);
	let usage: LlmUsage = {};
	let model = provider.name;
	let usedFallback = false;

	try {
		const result = await provider.chat(build_messages(body), {
			temperature,
			maxTokens: 256,
		});
		model = result.model;
		usage = map_usage(result.usage);
		plan = {
			...plan,
			...parse_plan(result.content),
		};
		await logPatchEvent("layout_plan_llm", {
			requestId,
			model,
			rawContent: result.content,
			plan,
		});
	} catch (error) {
		usedFallback = true;
		await logPatchEvent("layout_plan_fallback", {
			requestId,
			error: error instanceof Error ? error.message : "layout plan failed",
			plan,
		});
	}

	const patches = compile_layout_plan(plan, body.allowClassNames ?? []);
	if (!patches.length) {
		return null;
	}

	return {
		ok: true,
		patches,
		provider: provider_name_to_enum(provider.name),
		model,
		note: `Generated layout plan${usedFallback ? " with fallback" : ""}: ${describe_plan(plan)}.`,
		usage,
	};
}

function build_messages(body: GetPatchesOptions) {
	return [
		{
			role: "system" as const,
			content: `You convert resume layout requests into a small design plan.
Return one JSON object only. No markdown.
Allowed values:
layout: single_column | two_column | sidebar
density: compact | balanced | spacious
tone: classic | modern | editorial | executive
emphasis: content | sections | header | skills
accent: blue | green | purple | slate`,
		},
		{
			role: "user" as const,
			content: `Instruction: ${body.instruction}`,
		},
	];
}

function fallback_plan(instruction: string): LayoutPlan {
	const text = instruction.toLowerCase();
	return {
		layout:
			/two[- ]?column|两列|双栏|sidebar|侧栏/.test(text)
				? "two_column"
				: "single_column",
		density: /compact|紧凑|one[- ]?page|一页/.test(text)
			? "compact"
			: /spacious|宽松|breath|air/.test(text)
				? "spacious"
				: "balanced",
		tone: /executive|senior|高级|资深/.test(text)
			? "executive"
			: /editorial|designer|设计感|visual/.test(text)
				? "editorial"
				: /classic|traditional|传统/.test(text)
					? "classic"
					: "modern",
		emphasis: /skill|技能/.test(text)
			? "skills"
			: /header|name|标题|头部/.test(text)
				? "header"
				: /section|层级|hierarchy/.test(text)
					? "sections"
					: "content",
		accent: /green|绿色/.test(text)
			? "green"
			: /purple|紫/.test(text)
				? "purple"
				: /slate|gray|grey|灰/.test(text)
					? "slate"
					: "blue",
	};
}

function parse_plan(raw: string): LayoutPlan {
	const jsonText = extract_json(raw);
	const parsed = JSON.parse(jsonText) as Record<string, unknown>;
	return {
		layout: read_enum(parsed.layout, [
			"single_column",
			"two_column",
			"sidebar",
		]),
		density: read_enum(parsed.density, ["compact", "balanced", "spacious"]),
		tone: read_enum(parsed.tone, [
			"classic",
			"modern",
			"editorial",
			"executive",
		]),
		emphasis: read_enum(parsed.emphasis, [
			"content",
			"sections",
			"header",
			"skills",
		]),
		accent: read_enum(parsed.accent, ["blue", "green", "purple", "slate"]),
	};
}

function compile_layout_plan(
	plan: LayoutPlan,
	allowedClassNames: string[],
): UiPatch[] {
	const allowed = new Set(allowedClassNames);
	const patches: UiPatch[] = [];
	const add = (className: string, styles: Record<string, string>) => {
		if (!allowed.has(className)) return;
		patches.push({
			action: PatchAction.UpdateCss,
			selector: `.${className}`,
			styles,
		});
	};

	const spacing = plan.density === "compact" ? "18px" : plan.density === "spacious" ? "34px" : "26px";
	const pagePadding = plan.density === "compact" ? "34px" : plan.density === "spacious" ? "58px" : "46px";
	const accent = accent_color(plan.accent);

	add("resume", {
		maxWidth: plan.layout === "two_column" ? "900px" : "820px",
		padding: pagePadding,
		background: "#ffffff",
		color: plan.tone === "classic" ? "#1f2933" : "#18202a",
		fontFamily:
			plan.tone === "editorial"
				? "Georgia, 'Times New Roman', serif"
				: "Inter, ui-sans-serif, system-ui, sans-serif",
	});

	add("resume-header", {
		display: "grid",
		gridTemplateColumns:
			plan.layout === "two_column" || plan.layout === "sidebar"
				? "1.35fr 1fr"
				: "1fr",
		gap: plan.density === "compact" ? "12px" : "22px",
		alignItems: "end",
		borderBottom: `2px solid ${accent}`,
		paddingBottom: plan.density === "compact" ? "14px" : "22px",
		marginBottom: spacing,
	});

	add("resume-name", {
		fontSize: plan.tone === "executive" ? "38px" : "34px",
		lineHeight: "1",
		fontWeight: "750",
		color: "#111827",
	});

	add("resume-title", {
		fontSize: "14px",
		fontWeight: "650",
		color: accent,
		letterSpacing: "0",
		marginTop: "8px",
	});

	add("contact-list", {
		display: "grid",
		gap: "6px",
		justifyItems:
			plan.layout === "two_column" || plan.layout === "sidebar"
				? "end"
				: "start",
		fontSize: "12px",
		color: "#4b5563",
	});

	add("resume-section", {
		marginTop: spacing,
	});

	add("section-title", {
		fontSize: "11px",
		textTransform: "uppercase",
		letterSpacing: "0",
		color: accent,
		borderBottom: "1px solid #d7dee8",
		paddingBottom: "6px",
		marginBottom: plan.density === "compact" ? "10px" : "14px",
	});

	add("summary-text", {
		fontSize: plan.tone === "executive" ? "15px" : "14px",
		lineHeight: plan.density === "compact" ? "1.45" : "1.65",
		color: "#2f3a45",
	});

	add("experience-list", {
		display: "grid",
		gap: plan.density === "compact" ? "12px" : "18px",
	});

	add("job-title", {
		fontSize: "14px",
		fontWeight: "700",
		color: "#111827",
	});

	add("resume-meta", {
		fontSize: "12px",
		color: "#667085",
		marginTop: "3px",
	});

	add("skills-list", {
		display: "flex",
		flexWrap: "wrap",
		gap: plan.density === "compact" ? "6px" : "8px",
		listStyle: "none",
		padding: "0",
	});

	add("project-list", {
		display: "grid",
		gap: plan.density === "compact" ? "10px" : "14px",
	});

	return patches;
}

function extract_json(raw: string): string {
	const first = raw.indexOf("{");
	const last = raw.lastIndexOf("}");
	if (first >= 0 && last > first) {
		return raw.slice(first, last + 1);
	}
	return raw;
}

function read_enum<T extends string>(
	value: unknown,
	allowed: readonly T[],
): T | undefined {
	return typeof value === "string" && allowed.includes(value as T)
		? (value as T)
		: undefined;
}

function accent_color(accent: LayoutPlan["accent"]): string {
	switch (accent) {
		case "green":
			return "#0f766e";
		case "purple":
			return "#6d28d9";
		case "slate":
			return "#334155";
		case "blue":
		default:
			return "#1d4ed8";
	}
}

function describe_plan(plan: LayoutPlan): string {
	return [plan.layout, plan.density, plan.tone, plan.emphasis, plan.accent]
		.filter(Boolean)
		.join(", ");
}

function provider_name_to_enum(name: string): LlmProvider {
	switch (name.toLowerCase()) {
		case "openai":
			return LlmProvider.OpenAI;
		case "ollama":
		default:
			return LlmProvider.Ollama;
	}
}

function map_usage(usage?: {
	promptTokens?: number;
	completionTokens?: number;
	totalDuration?: number;
	loadDuration?: number;
	promptEvalDuration?: number;
	evalDuration?: number;
}): LlmUsage {
	return {
		promptEvalCount: usage?.promptTokens,
		evalCount: usage?.completionTokens,
		totalDuration: usage?.totalDuration,
		loadDuration: usage?.loadDuration,
		promptEvalDuration: usage?.promptEvalDuration,
		evalDuration: usage?.evalDuration,
	};
}
