import { PatchAction, type UiPatch } from "@repo/schema";
import type { RunPatchState } from "./run.js";

export function parseLlmResponse(state: RunPatchState) {
    const s = {...state}
    const rawRes = s.modelOutput

    // check if is json array, start with [ ]
    const startLeftSqBracket = rawRes.indexOf('[')
    const endRightSqBracket = rawRes.lastIndexOf(']')

    if (startLeftSqBracket === -1 || endRightSqBracket === -1 ){
        throw new Error("Invalid Json from llm: not a json array: " + rawRes.slice(10))
    }

    if (rawRes.startsWith("```")) {
        throw new Error("Invalid Json from llm: a markdown style thing: " + rawRes.slice(10))
    }

    let resArr: unknown[] = [];
    try{
        resArr = JSON.parse(rawRes)
    } catch {
        throw new Error ("Failed to Parse JSON from llm: " + rawRes.slice(10))
    }

    for (const rawPatch of resArr) {
        if (!rawPatch) continue;

        // not action patch
        if (typeof rawPatch !== "object" || rawPatch === null || !rawPatch.hasOwnProperty("action")) {
            if (!rawPatch){
                s.invalidPatchesTmp.push("invalid null/undefined")
            }
            else if (typeof rawPatch === "object"){
                s.invalidPatchesTmp.push(rawPatch)
            } 
            else {
                s.invalidPatchesTmp.push("Weird Stuff")
            }
            continue
        }

        const patch = rawPatch as Record<string, unknown>;
        let validPatch: UiPatch;
        
        switch(patch.action){
            case PatchAction.UpdateCss:
                validPatch = {
                    action: PatchAction.UpdateCss,
                    selector: String(patch.selector ?? ""),
                    styles: (patch.styles as Record<string, string>) ?? {}
                }
                break;
            case PatchAction.UpdateText:
                validPatch = {
                    action: PatchAction.UpdateText,
                    selector: String(patch.selector ?? ""),
                    text: String(patch.text ?? ""),
                }
                break;
            case PatchAction.InsertElement:
                validPatch = {
                    action: PatchAction.InsertElement,
                    parent: String(patch.parent ?? patch.selector ?? ""),
                    html: String(patch.html ?? ""),
                }
                break;
            case PatchAction.RemoveElement:
                validPatch = {
                    action: PatchAction.RemoveElement,
                    selector: String(patch.selector ?? ""),
                }
                break;
            case PatchAction.CloneElement:
                validPatch = {
                    action: PatchAction.CloneElement,
                    source: String(patch.source ?? patch.sourcePage ?? "1"),
                    parent: String(patch.parent ?? patch.targetPage ?? ""),
                }
                break;
            default:
                s.invalidPatchesTmp.push(patch)
                continue;
        }

        s.validPatches.push(validPatch)
    }

    return s
}
