// the workflow to get patches from llm

import { type GetPatchesOptions, type LlmUsage, type PatchResults, type UiPatch } from "@repo/schema";
import { cleanInput } from "./clean-input.js";
import { randomUUID } from "node:crypto";
import { useFullDom } from "./use-full-dom.js";
import { basePrompt } from "./base-prompt.js";
import { loadSkills } from "./load-skills.js";
import { feedToLlm } from "./feed-to-llm.js";
import { loadChatHistory } from "./load-chat-history.js";
import { parseLlmResponse } from "./parse-llm-response.js";
import { logPatchEvent } from "../../logger.js";
import { tryRunLayoutPlan } from "./layout-plan.js";
import { provider_name_to_enum } from "../llm-utils.js";
import { run_workflow, type WorkflowStep } from "../workflow.js";

export type RunPatchState = {
    id: string,
    request: GetPatchesOptions,
    skills: string[],
    prompt: string,
    useFullDom: boolean,
    modelOutput: string,
    modelUsage: LlmUsage,
    invalidPatchesTmp: (Object | string)[],
    validPatches: UiPatch[],
    validPatchesChanges: string[],
    notes: string,
    parseAttempts: number,
    providerName: string,
    model: string,

    queueRef: PatchGeneratorStep[]
}

type PatchGeneratorStep = WorkflowStep<RunPatchState>;

export async function runPatchGen(
    body: GetPatchesOptions,
    requestId: string = randomUUID(),
): Promise<PatchResults> {
    const layoutResult = await tryRunLayoutPlan(body, requestId);
    if (layoutResult) {
        return layoutResult;
    }

    const runQueue: PatchGeneratorStep[] = [
        cleanInput, useFullDom, basePrompt, loadChatHistory, loadSkills, feedToLlm,
        parseLlmResponse,
    ];

    let state: RunPatchState = {
        id: requestId,
        request: body,
        skills: [],
        prompt: '',
        useFullDom: false,
        modelOutput: '',
        invalidPatchesTmp: [],
        modelUsage: {},
        validPatches: [],
        // for debug
        validPatchesChanges: [],
        notes: '',
        parseAttempts: 0,
        providerName: '',
        model: '',

        queueRef: runQueue
    };


    const MAX_STEPS = 30;
    const workflowResult = await run_workflow(state, runQueue, {
        maxSteps: MAX_STEPS,
    });
    state = workflowResult.state;

    await logPatchEvent("Queue Done", {
        requestId,
        stepCount: workflowResult.stepCount,
        remainingStepCount: workflowResult.remainingStepCount,
        useFullDom: state.useFullDom,
        patchCount: state.validPatches.length,
        changes: state.validPatchesChanges.join(';'),
        invalidCount: state.invalidPatchesTmp.length,
        invalidExample: state.invalidPatchesTmp.length > 0 ? state.invalidPatchesTmp[0] : ""
    })

    const result: PatchResults = {
        ok: true,
        patches: state.validPatches,
        provider: provider_name_to_enum(state.providerName),
        model: state.model || state.providerName,
        note: state.notes + ` Steps: ${workflowResult.stepCount} `,
        usage: state.modelUsage
    }

    return result;
}
