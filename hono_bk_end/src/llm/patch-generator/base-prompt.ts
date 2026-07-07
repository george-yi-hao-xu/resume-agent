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
Example shape only, do not copy these values:
[{"action":"update_text","selector":"CSS selector","from":"current text","to":"new text"}]

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
