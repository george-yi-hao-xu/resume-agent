import { PatchAction, type UiPatch, type UpdateElementAttrPatch, type UpdateTextPatch } from "@repo/schema";
import type { RunPatchState } from "./run.js";
import { feedToLlm } from "./feed-to-llm.js";
import { logPatchEvent } from "../../logger.js";

const MAX_PARSE_ATTEMPTS = 2;

export function parseLlmResponse(state: RunPatchState) {
    const s = {...state}
    let rawRes = s.modelOutput.replaceAll("\n","")

    // check if is json array, start with [ ]
    const startLeftSqBracket = rawRes.indexOf('[')
    const endRightSqBracket = rawRes.lastIndexOf(']')

    if (startLeftSqBracket === -1 || endRightSqBracket === -1 ){
        if (s.parseAttempts < MAX_PARSE_ATTEMPTS) {
            return schedule_parse_retry(s, "Your previous response was not a valid JSON array. Return ONLY a JSON array of patches.");
        }
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
        if (s.parseAttempts < MAX_PARSE_ATTEMPTS) {
            return schedule_parse_retry(s, "Your previous response contained invalid JSON. Return ONLY a valid JSON array of patches.");
        }
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
                if (!isStringRecord(patch.attributes)) {
                    s.invalidPatchesTmp.push(patch)
                    continue
                }
                after = {
                    action: PatchAction.UpdateElementAttr,
                    selector: String(patch.selector ?? ""),
                    attributes: patch.attributes,
                } as UpdateElementAttrPatch
                track(patch, after, change)
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
            case PatchAction.ClonePage:
                {
                    const sourcePage = String(patch.sourcePage ?? "1");
                    const targetPage = String(patch.targetPage ?? "");
                    if (!isPageId(sourcePage) || !isPageId(targetPage)) {
                        s.invalidPatchesTmp.push(patch)
                        continue
                    }

                    after = {
                        action: PatchAction.ClonePage,
                        sourcePage,
                        targetPage,
                        targetLanguage: typeof patch.targetLanguage === "string"
                            ? patch.targetLanguage
                            : undefined,
                    }
                }
                track(patch, after, change)
                break;
            case PatchAction.TranslatePage:
                {
                    const page = String(patch.page ?? patch.targetPage ?? "");
                    const textUpdates = readTextUpdates(patch.textUpdates);
                    if (!isPageId(page) || textUpdates.length === 0) {
                        s.invalidPatchesTmp.push(patch)
                        continue
                    }

                    after = {
                        action: PatchAction.TranslatePage,
                        page,
                        targetLanguage: String(patch.targetLanguage ?? "zh-CN"),
                        textUpdates,
                    }
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

function isStringRecord(value: unknown): value is Record<string, string> {
    return !!value
        && typeof value === "object"
        && !Array.isArray(value)
        && Object.values(value).every((item) => typeof item === "string");
}

function isPageId(value: string): boolean {
    return /^\d+$/.test(value.trim());
}

function readTextUpdates(value: unknown): Array<{ selector: string; text: string }> {
    if (!Array.isArray(value)) return [];

    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const selector = String(record.selector ?? "").trim();
        const text = String(record.text ?? "").trim();
        return selector && text ? [{ selector, text }] : [];
    });
}

function schedule_parse_retry(
    state: RunPatchState,
    feedback: string,
): RunPatchState {
    state.queueRef.push(feedToLlm, parseLlmResponse);
    return {
        ...state,
        parseAttempts: state.parseAttempts + 1,
        prompt: `${state.prompt}\n${feedback}`,
    };
}
