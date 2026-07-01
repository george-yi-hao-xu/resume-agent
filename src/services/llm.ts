import { DEFAULT_OLLAMA_MODEL, OLLAMA_URL } from "../constants";
import { PatchAction, type PatchProviderResult, type UiPatch } from "../types";

export async function getPatchesFromInstruction(
  instruction: string,
  model = DEFAULT_OLLAMA_MODEL
): Promise<PatchProviderResult> {
  console.log("[llm.getPatchesFromInstruction]", { instruction, model });
  const patches = await callOllama(instruction, model);
  console.log("[llm.getPatchesFromInstruction:result]", { patches });
  return { patches, provider: "ollama", model };
}

async function callOllama(instruction: string, model: string): Promise<UiPatch[]> {
  console.log("[llm.callOllama]", { instruction, model, url: OLLAMA_URL });
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
    console.log("[llm.callOllama:responseError]", { status: response.status });
    throw new Error(`Ollama returned ${response.status}.`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  console.log("[llm.callOllama:rawResponse]", { data, content });
  if (!content) {
    throw new Error("Ollama returned an empty response.");
  }

  return parseAndValidatePatches(content);
}

function parseAndValidatePatches(raw: string): UiPatch[] {
  console.log("[llm.parseAndValidatePatches]", { raw });
  const json = extractJsonArray(raw);
  const parsed = JSON.parse(json) as unknown;
  console.log("[llm.parseAndValidatePatches:parsed]", { parsed });

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
  console.log("[llm.extractJsonArray]", { raw });
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < start) {
    throw new Error("No JSON array found in model response.");
  }

  const json = raw.slice(start, end + 1);
  console.log("[llm.extractJsonArray:result]", { json });
  return json;
}

function isUiPatch(value: unknown): value is UiPatch {
  console.log("[llm.isUiPatch]", { value });
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
  console.log("[llm.isStringRecord]", { value });
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
- For adding a skill, always use {"action":"insert_html","parent":".skills-list","position":"beforeend","html":"<li>Skill name</li>"}.
- For adding experience, insert an <article class="resume-item experience-item"> into .experience-list.
- For adding a project, insert an <article class="resume-item project-item"> into .project-list.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs.`;
