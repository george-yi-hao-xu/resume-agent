// llm.ts

import { RESUME_SELECTORS, cls } from "../core/resumeSelectors";
import { PatchAction, type PatchProviderResult, type UiPatch, CHAT_ROLE } from "../types";

export async function getPatchesFromInstruction(
  instruction: string,
  model: string,
  backEndUrl: string,
  temperature: number,
): Promise<PatchProviderResult> {
  const patches = await callOllama(instruction, model, backEndUrl, temperature);

  return { patches, provider: "ollama", model };
}

async function callOllama(instruction: string, model: string, backEndUrl: string, temperature = 0.1): Promise<UiPatch[]> {
  const response = await fetch(backEndUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: CHAT_ROLE.SYSTEM,
          content: SYSTEM_PROMPT
        },
        {
          role: CHAT_ROLE.USER,
          content: instruction
        }
      ],
      options: {
        temperature: temperature
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}.`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) {
    throw new Error("Ollama returned an empty response.");
  }

  return parseAndValidatePatches(content);
}

function parseAndValidatePatches(raw: string): UiPatch[] {
  const json = extractJsonArray(raw);
  const parsed = JSON.parse(json) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Model response must be a JSON array.");
  }

  const patches = parsed.filter(isUiPatch);
  if (patches.length !== parsed.length) {
    throw new Error("Model returned one or more invalid patches.");
  }

  return patches;
}

function extractJsonArray(raw: string): string {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("No JSON array found in model response.");
  }

  return raw.slice(start, end + 1);
}

function isUiPatch(value: unknown): value is UiPatch {
  if (!value || typeof value !== "object" || !("action" in value)) {
    return false;
  }

  const patch = value as Record<string, unknown>;

  if (patch.action === PatchAction.UpdateCss) {
    return (
      typeof patch.selector === "string" &&
      isStringRecord(patch.styles)
    );
  }

  if (patch.action === PatchAction.UpdateText) {
    return typeof patch.selector === "string" && typeof patch.text === "string";
  }

  if (patch.action === PatchAction.InsertHtml) {
    return (
      typeof patch.parent === "string" &&
      typeof patch.html === "string" &&
      (patch.position === undefined || typeof patch.position === "string")
    );
  }

  if (patch.action === PatchAction.RemoveElement) {
    return typeof patch.selector === "string";
  }

  return false;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

const SYSTEM_PROMPT = `You convert a user's natural language page-editing instruction into JSON UI patches.

Return ONLY a valid JSON array. No markdown. No commentary.

Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
4. {"action":"remove_element","selector":"CSS selector"}

The preview is a resume. Available page selectors:
${Object.values(RESUME_SELECTORS).map((selector) => `- ${selector}`).join("\n")}

Rules:
- Do not return a full HTML document.
- Prefer small, targeted patches.
- Use ${RESUME_SELECTORS.summaryText} only for the top resume summary paragraph. Use ${RESUME_SELECTORS.projectSummary} for project descriptions.
- Use only selectors that exist in the resume preview unless inserting into ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList}.
- For adding a skill, always use {"action":"insert_html","parent":"${RESUME_SELECTORS.skillsList}","position":"beforeend","html":"<li>Skill name</li>"}.
- For adding experience, insert an <article class="resume-item ${cls(RESUME_SELECTORS.experienceItem)}"> into ${RESUME_SELECTORS.experienceList}.
- For adding a project, insert an <article class="resume-item ${cls(RESUME_SELECTORS.projectItem)}"> into ${RESUME_SELECTORS.projectList}.
- For changing the resume accent color, update ${RESUME_SELECTORS.resume} with {"--accent-color":"color"}.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs.`;
