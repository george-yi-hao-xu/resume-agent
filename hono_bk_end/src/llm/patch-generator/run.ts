// the workflow to get patches from llm

import { LlmProvider, type GetPatchesOptions, type LlmUsage, type PatchResults, type UiPatch } from "@repo/schema";
import { cleanInput } from "./clean-input.js";
import { randomUUID } from "node:crypto";
import { useFullDom } from "./use-full-dom.js";
import { basePrompt } from "./base-prompt.js";
import { loadSkills } from "./load-skills.js";
import { feedToLlm } from "./feed-to-llm.js";
import { loadChatHistory } from "./load-chat-history.js";
import { parseLlmResponse } from "./parse-llm-response.js";

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
    notes: string,
}

type PatchGeneratorStep = (
    state: RunPatchState,
) => RunPatchState | Promise<RunPatchState>;

export async function runPatchGen(
    body: GetPatchesOptions,
): Promise<PatchResults> {
    let state: RunPatchState = {
        id: randomUUID(),
        request: body,
        skills: [],
        prompt: '',
        useFullDom: false,
        modelOutput: '',
        invalidPatchesTmp: [],
        modelUsage: {},
        validPatches: [],
        notes: ''
    };

    const runQueue: PatchGeneratorStep[] = [
        cleanInput, useFullDom, basePrompt, loadChatHistory, loadSkills, feedToLlm,
        parseLlmResponse,
    ];

    let counter = 0;
    const MAX_STEPS = 30

    // for (const step of queue) {
    //     state = step(state)
    // }

    while (runQueue.length > 0 && counter <= MAX_STEPS) {
        const curr = runQueue[0]
        state = await curr(state)
        runQueue.shift()
        counter++
    }

    const result: PatchResults = {
        ok: true,
        patches: state.validPatches,
        provider: LlmProvider.Ollama,
        model: "qwen2.7-coder:7b",
        note: state.notes + ` Steps: ${counter} `,
        usage: state.modelUsage
    }

    return result;
}
