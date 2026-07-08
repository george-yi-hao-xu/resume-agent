import type { RunPatchState } from "./run.js";
import { PATCH_TYPES, RESUME_TYPES, PatchAction } from "@repo/schema";

const INTRO =`
You convert a user's natural language page-editing instruction into JSON UI patches.
The resume is tracked as a plain js object.
this is the type of it

${RESUME_TYPES}

The patch format is:

${PATCH_TYPES}

Return ONLY a valid JSON array, which can contain several patches.
In case only one patch, still wrap it as an array. No markdown. No commentary.

Selector rule: the CSS selector in every patch MUST be one of the allowed class names listed below. Do not invent new class names or use tag-only selectors.

Examples (do not copy values, only the shape):
Instruction: "Change the job title to Senior Engineer"
[{"action":"update_text","selector":".resume-title","from":"Current title text","to":"Senior Engineer"}]

Instruction: "Make the main layout a 2-column grid"
[{"action":"update_css","selector":".resume-container","styles":{"display":"grid","grid-template-columns":"1fr 1fr","gap":"1rem"}}]

Instruction: "Add a second page and translate it to Chinese"
[{"action":"clone_page","sourcePage":"1","targetPage":"2"},{"action":"translate_page","page":"2","targetLanguage":"zh-CN","textUpdates":[{"selector":".resume-title","text":"高级软件工程师"}]}]

Use the current DOM and the user's instruction to choose the selector and values.
Do not invent actions. Use "clone_page" for page duplication and "clone_element" only for normal DOM element cloning.
For page duplication, sourcePage and targetPage must be numeric strings like "1" and "2". Language names belong only in targetLanguage.
For translated pages, return two patches in order: first clone_page, then translate_page with textUpdates for the cloned page.

Remember the allowed actions are these: ${Object.values(PatchAction)}.

`;

export function basePrompt(s: RunPatchState){
    const allowed = s.request.allowClassNames
    return {
        ...s,
        prompt: `${s.prompt} ${INTRO}\n The allowed class names as selectors are ${allowed?.join(',')}`
    }
}
