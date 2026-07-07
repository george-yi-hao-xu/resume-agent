import type {
	LlmUsage,
	PatchProviderResult,
	UiPatch,
} from "../../client/src/types";
import type { StructuredLogger } from "../logger/structured-logger";
import type { LlmRuntimeConfig } from "./llm.config";
import type { LlmProviderService } from "./llm-provider.service";
import { parsePatchResponse } from "./llm.patch-parser";
import {
	buildPatchModelMessages,
	shouldIncludeFullDom,
} from "./llm.prompt-builder";
import type { GeneratePatchesRequest, ModelMessage } from "./llm.types";

export type PatchWorkflowState = {
	request: GeneratePatchesRequest;
	requestId: string;
	startedAt: number;
	resumeSummary?: string;
	resumeDom?: string;
	usedFullDom?: boolean;
	messages?: ModelMessage[];
	rawContent?: string;
	usage?: LlmUsage;
	patches?: UiPatch[];
	invalidPatchCount?: number;
	result?: PatchProviderResult;
};

export type PatchWorkflowContext = {
	config: LlmRuntimeConfig;
	logger: StructuredLogger;
	providerService: Pick<LlmProviderService, "callRaw">;
};

export type PatchWorkflowStep = (
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
) => PatchWorkflowState | Promise<PatchWorkflowState>;

export const DEFAULT_PATCH_WORK_FLOW_STEPS: PatchWorkflowStep[] = [
	normalizePatchRequestStep,
	selectPatchContextStep,
	buildPatchMessagesStep,
	logPatchRequestStartedStep,
	callPatchModelStep,
	parsePatchOutputStep,
	logPatchRequestCompletedStep,
	buildPatchResultStep,
];

export async function runPatchWorkflow(
	initialState: PatchWorkflowState,
	context: PatchWorkflowContext,
	steps: PatchWorkflowStep[] = DEFAULT_PATCH_WORK_FLOW_STEPS,
): Promise<PatchWorkflowState> {
	let state = initialState;
	for (const step of steps) {
		state = await step(state, context);
	}
	return state;
}

export function normalizePatchRequestStep(
	state: PatchWorkflowState,
): PatchWorkflowState {
	return {
		...state,
		resumeSummary:
			state.request.resumeSummary ?? state.request.resumeStructure ?? "",
		resumeDom: state.request.resumeDom ?? "",
	};
}

export function selectPatchContextStep(
	state: PatchWorkflowState,
): PatchWorkflowState {
	return {
		...state,
		usedFullDom: shouldIncludeFullDom(
			state.request.instruction,
			state.request.conversationHistory ?? [],
		),
	};
}

export function buildPatchMessagesStep(
	state: PatchWorkflowState,
): PatchWorkflowState {
	const resumeSummary =
		state.resumeSummary ??
		state.request.resumeSummary ??
		state.request.resumeStructure ??
		"";
	const resumeDom = state.resumeDom ?? state.request.resumeDom ?? "";

	return {
		...state,
		messages: buildPatchModelMessages(
			state.request.instruction,
			state.request.allowedCssCustomProperties ?? [],
			state.request.conversationHistory ?? [],
			resumeSummary,
			state.usedFullDom ? resumeDom : "",
		),
	};
}

export function logPatchRequestStartedStep(
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
): PatchWorkflowState {
	const messages = requireMessages(state);
	const resumeSummary = state.resumeSummary ?? "";
	const resumeDom = state.resumeDom ?? "";

	context.logger.info("llm_request_started", {
		requestId: state.requestId,
		provider: context.config.provider,
		model: context.config.model,
		messageCount: messages.length,
		instruction: state.request.instruction,
		usedFullDom: !!state.usedFullDom,
		resumeSummaryLength: resumeSummary.length,
		resumeDomLength: resumeDom.length,
		messages,
	});

	return state;
}

export async function callPatchModelStep(
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
): Promise<PatchWorkflowState> {
	const messages = requireMessages(state);
	context.logger.info("STEP", {
		requestId: state.requestId,
		provider: context.config.provider,
		model: context.config.model,
		messageCount: messages.length,
		usedFullDom: !!state.usedFullDom,
	});

	const result = await context.providerService.callRaw(
		context.config,
		messages,
	);

	context.logger.info("STEP", {
		requestId: state.requestId,
		provider: context.config.provider,
		model: context.config.model,
		rawOutputLength: result.rawContent.length,
		usage: result.usage,
	});

	return {
		...state,
		rawContent: result.rawContent,
		usage: result.usage,
	};
}

export function parsePatchOutputStep(
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
): PatchWorkflowState {
	const rawContent = requireRawContent(state);
	context.logger.info("llm_patch_parse_started", {
		requestId: state.requestId,
		rawOutputLength: rawContent.length,
	});

	try {
		const parsed = parsePatchResponse(rawContent);

		context.logger.info("llm_patch_parse_completed", {
			requestId: state.requestId,
			patchCount: parsed.patches.length,
			invalidPatchCount: parsed.invalidPatchCount,
		});

		return {
			...state,
			patches: parsed.patches,
			invalidPatchCount: parsed.invalidPatchCount,
		};
	} catch (error) {
		context.logger.error("llm_patch_parse_failed", {
			requestId: state.requestId,
			rawOutput: rawContent,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new Error(
			`Patch response parsing failed: ${
				error instanceof Error ? error.message : String(error)
			}`,
		);
	}
}

export function logPatchRequestCompletedStep(
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
): PatchWorkflowState {
	context.logger.info("llm_request_completed", {
		requestId: state.requestId,
		provider: context.config.provider,
		model: context.config.model,
		durationMs: Date.now() - state.startedAt,
		usage: requireUsage(state),
		rawOutput: requireRawContent(state),
		patches: requirePatches(state),
	});

	return state;
}

export function buildPatchResultStep(
	state: PatchWorkflowState,
	context: PatchWorkflowContext,
): PatchWorkflowState {
	const invalidPatchCount = state.invalidPatchCount ?? 0;

	return {
		...state,
		result: {
			patches: requirePatches(state),
			provider: context.config.provider,
			model: context.config.model,
			usage: requireUsage(state),
			note: invalidPatchCount
				? `Ignored ${invalidPatchCount} invalid patch${invalidPatchCount === 1 ? "" : "es"} from the model.`
				: undefined,
		},
	};
}

function requireMessages(state: PatchWorkflowState): ModelMessage[] {
	if (!state.messages) {
		throw new Error("Patch workflow messages have not been built.");
	}

	return state.messages;
}

function requireRawContent(state: PatchWorkflowState): string {
	if (state.rawContent === undefined) {
		throw new Error("Patch workflow raw model output is missing.");
	}

	return state.rawContent;
}

function requireUsage(state: PatchWorkflowState): LlmUsage {
	if (!state.usage) {
		throw new Error("Patch workflow usage is missing.");
	}

	return state.usage;
}

function requirePatches(state: PatchWorkflowState): UiPatch[] {
	if (!state.patches) {
		throw new Error("Patch workflow patches have not been parsed.");
	}

	return state.patches;
}
