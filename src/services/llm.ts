import { DEFAULT_OLLAMA_MODEL, OLLAMA_URL } from "../constants";
import { PatchAction, type PatchProviderResult, type UiPatch } from "../types";

export async function getPatchesFromInstruction(
  instruction: string,
  model = DEFAULT_OLLAMA_MODEL
): Promise<PatchProviderResult> {
  const patches = await callOllama(instruction, model);
  return { patches, provider: "ollama", model };
}

async function callOllama(instruction: string, model: string): Promise<UiPatch[]> {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: instruction
        }
      ],
      options: {
        temperature: 0.1
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

const systemPrompt = `You convert a user's natural language page-editing instruction into JSON UI patches.

Return ONLY a valid JSON array. No markdown. No commentary.

Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
4. {"action":"remove_element","selector":"CSS selector"}

The preview is a resume. Available page selectors:
- .resume
- .resume-header
- .resume-name
- .resume-title
- .contact-list
- .contact-email
- .contact-phone
- .contact-location
- .contact-portfolio
- .summary-section
- .summary-text
- .experience-section
- .experience-list
- .experience-item
- .job-title
- .resume-meta
- .bullet-list
- .skills-section
- .skills-list
- .project-section
- .project-list
- .project-item

Rules:
- Do not return a full HTML document.
- Prefer small, targeted patches.
- Use only selectors that exist in the resume preview unless inserting into .skills-list, .experience-list, .project-list, or .bullet-list.
- For adding a skill, insert a single <li> into .skills-list.
- For adding experience, insert an <article class="resume-item experience-item"> into .experience-list.
- For adding a project, insert an <article class="resume-item project-item"> into .project-list.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs.`;
