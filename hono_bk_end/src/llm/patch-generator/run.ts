// the workflow to get patches from llm

import { LlmProvider, type GetPatchesOptions, type LlmUsage, type PatchResults, type UiPatch } from "@repo/schema";
import { cleanInput } from "./clean-input.js";
import { randomUUID } from "node:crypto";
import { useFullDom } from "./use-full-dom.js";

export type RunPatchState = {
    id: string,
    request: GetPatchesOptions,
    prompt: string,
    useFullDom: boolean,
    modelOutput: string,
    modelUsage: LlmUsage,
    validPatches: UiPatch[],
    notes: string,
}

export function runPatchGen(body: GetPatchesOptions){
    let state: RunPatchState = {
        id: randomUUID(),
        request: body,
        prompt: '',
        useFullDom: false,
        modelOutput: '',
        modelUsage: {},
        validPatches: [],
        notes: ''
    };

    const STEPS = [
        cleanInput, useFullDom
    ]

    for (const step of STEPS) {
        state = step(state)
    }

    const result: PatchResults = {
        ok: true,
        patches: state.validPatches,
        provider: LlmProvider.Ollama,
        model: "qwen2.7-coder:7b",
        note: state.notes,
        usage: state.modelUsage
    }

    return {} 
}
