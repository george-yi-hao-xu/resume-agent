import { PatchAction, type UiPatch, type UpdateElementAttrPatch, type UpdateTextPatch } from "@repo/schema";
import type { RunPatchState } from "./run.js";
import { feedToLlm } from "./feed-to-llm.js";
import { logPatchEvent } from "../../logger.js";

export function parseLlmResponse(state: RunPatchState) {
    const s = {...state}
    let rawRes = s.modelOutput.replaceAll("\n","")

    // check if is json array, start with [ ]
    const startLeftSqBracket = rawRes.indexOf('[')
    const endRightSqBracket = rawRes.lastIndexOf(']')

    if (startLeftSqBracket === -1 || endRightSqBracket === -1 ){
        throw new Error("Invalid Json from llm: not a json array->" + rawRes.slice(0, 10))
    }

    if (rawRes.startsWith("\`")) {
        rawRes = rawRes.slice(7,-3)
    }

    let resArr: unknown[] = [];
    let change: string[] = [];

    try{
        resArr = JSON.parse(rawRes)
    } catch {
        throw new Error ("Failed to Parse JSON from llm->" + rawRes.slice(0, 10))
    }

    logPatchEvent("Finished llm res parse, raw->" + rawRes)

    for (const before of resArr) {
        if (!before) continue;

        // not action patch
        if (typeof before !== "object" || before === null || !before.hasOwnProperty("action")) {
            if (!before){
                s.invalidPatchesTmp.push("invalid null/undefined")
            }
            else if (typeof before === "object"){
                s.invalidPatchesTmp.push(before)
            } 
            else {
                s.invalidPatchesTmp.push("Weird Stuff")
            }
            continue
        }

        const patch = before as Record<string, unknown>;
        let after: UiPatch;
        const allowed = s.request.allowClassNames
        
        switch(patch.action){
            case PatchAction.UpdateCss:
                after = {
                    action: PatchAction.UpdateCss,
                    selector: String(patch.selector ?? ""),
                    styles: (patch.styles as Record<string, string>) ?? {}
                }
                track(patch, after, change)
                break;
            case PatchAction.UpdateText:
                if(!checkAllowed(String(patch.selector ?? ""), allowed)){
                    // stop parsing; add new jobs back into the queue
                    s.queueRef.push(feedToLlm, parseLlmResponse)

                    return {
                        ...s,
                        prompt: `${s.prompt}\n Do not use ${String(patch.selector)} as the selector, making sure to get from allowed class names `
                    }
                }
                
                after = {
                    action: PatchAction.UpdateText,
                    selector: String(patch.selector ?? ""),
                    from: String(patch.from ?? ""),
                    // somehow llm ignores the type, make 'text' key 'value'
                    to: String(patch.to ?? patch.text ?? patch.value ?? ""),
                } as UpdateTextPatch
                track(patch, after, change)
                break;
            case PatchAction.UpdateElementAttr:
                after = {
                    action: PatchAction.UpdateElementAttr,
                    selector: String(patch.selector ?? ""),
                    attr: String(patch.attr ?? ""),
                    value: String(patch.value ?? ""),
                } as UpdateElementAttrPatch
                break;
            case PatchAction.InsertElement:
                after = {
                    action: PatchAction.InsertElement,
                    parent: String(patch.parent ?? patch.selector ?? ""),
                    html: String(patch.html ?? ""),
                }
                track(patch, after, change)
                break;
            case PatchAction.RemoveElement:
                after = {
                    action: PatchAction.RemoveElement,
                    selector: String(patch.selector ?? ""),
                }
                track(patch, after, change)
                break;
            case PatchAction.CloneElement:
                after = {
                    action: PatchAction.CloneElement,
                    source: String(patch.source ?? patch.sourcePage ?? "1"),
                    parent: String(patch.parent ?? patch.targetPage ?? ""),
                }
                track(patch, after, change)
                break;
            default:
                s.invalidPatchesTmp.push(patch)
                continue;
        }

        s.validPatches.push(after)
    }


    return s
}

function track(before: Record<string, unknown>, after: UiPatch, track: string[]) {
    const beforeStr = JSON.stringify(before)
    const afterStr = JSON.stringify(after)
    if (beforeStr !== afterStr){
        track.push(`${beforeStr} -> ${afterStr}`)
    }
}

function checkAllowed(className: string, allowed: string[] | undefined) {
    if (!allowed) return true;

    return allowed.includes(className)
}
