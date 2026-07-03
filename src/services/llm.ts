// llm.ts

import { OPENAI_CHAT_COMPLETIONS_URL } from "../constants";
import { RESUME_SELECTORS, cls } from "../core/resumeSelectors";
import { PatchAction, type ChatMessage, type LlmUsage, LlmProvider, type PatchProviderResult, type UiPatch, CHAT_ROLE } from "../types";

export type OllamaHealthResult =
  | { ok: true }
  | { ok: false; reason: "offline" | "model_missing"; message: string };

type ModelMessage = {
  role: CHAT_ROLE.SYSTEM | CHAT_ROLE.USER | CHAT_ROLE.ASSISTANT;
  content: string;
};

type PatchGenerationResult = {
  patches: UiPatch[];
  usage: LlmUsage;
};

type GetPatchesOptions = {
  instruction: string;
  provider: LlmProvider;
  model: string;
  backEndUrl: string;
  openAiApiKey: string;
  temperature: number;
  allowedCssCustomProperties?: string[];
  conversationHistory?: ChatMessage[];
  resumeStructure?: string;
};

export class LlmService {
  async getPatchesFromInstruction(options: GetPatchesOptions): Promise<PatchProviderResult> {
    const {
      instruction,
      provider,
      model,
      backEndUrl,
      openAiApiKey,
      temperature,
      allowedCssCustomProperties = [],
      conversationHistory = [],
      resumeStructure = ""
    } = options;
    const messages = this.buildModelMessages(
      instruction,
      allowedCssCustomProperties,
      conversationHistory,
      resumeStructure
    );
    const result = provider === LlmProvider.OpenAI
      ? await this.callOpenAI(model, openAiApiKey, temperature, messages)
      : await this.callOllama(model, backEndUrl, temperature, messages);

    const resultObj = { patches: result.patches, provider, model, usage: result.usage };
    console.log("Result: ", resultObj);

    return resultObj;
  }

  async checkOllamaHealth(backEndUrl: string, model: string, timeoutMs = 3000): Promise<OllamaHealthResult> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(getOllamaTagsUrl(backEndUrl), {
        method: "GET",
        signal: controller.signal
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: "offline",
          message: `Ollama returned ${response.status}.`
        };
      }

      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
      const models = data.models ?? [];
      const hasModel = models.some((item) => item.name === model || item.model === model);

      if (!hasModel) {
        return {
          ok: false,
          reason: "model_missing",
          message: `Model ${model} was not found.`
        };
      }

      return { ok: true };
    } catch {
      return {
        ok: false,
        reason: "offline",
        message: "Ollama is not reachable."
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async warmupOllama(backEndUrl: string, model: string, timeoutMs = 30000): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(backEndUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          stream: false,
          keep_alive: "10m",
          messages: [
            {
              role: CHAT_ROLE.USER,
              content: "ping"
            }
          ],
          options: {
            num_predict: 1,
            temperature: 0
          }
        })
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private buildModelMessages(
    instruction: string,
    allowedCssCustomProperties: string[],
    conversationHistory: ChatMessage[],
    resumeStructure: string
  ): ModelMessage[] {
    return [
      {
        role: CHAT_ROLE.SYSTEM,
        content: this.buildSystemPrompt(allowedCssCustomProperties, resumeStructure)
      },
      ...this.buildConversationMessages(conversationHistory),
      {
        role: CHAT_ROLE.USER,
        content: instruction
      }
    ];
  }

  private async callOpenAI(
    model: string,
    apiKey: string,
    temperature: number,
    messages: ModelMessage[]
  ): Promise<PatchGenerationResult> {
    if (!apiKey) {
      throw new Error("OpenAI API key is required.");
    }

    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    return {
      patches: this.parseAndValidatePatches(content),
      usage: {
        promptEvalCount: data.usage?.prompt_tokens,
        evalCount: data.usage?.completion_tokens
      }
    };
  }

  private async callOllama(
    model: string,
    backEndUrl: string,
    temperature: number,
    messages: ModelMessage[]
  ): Promise<PatchGenerationResult> {
    const response = await fetch(backEndUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: {
          temperature: temperature
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}.`);
    }

    const data = (await response.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
      total_duration?: number;
      load_duration?: number;
      prompt_eval_duration?: number;
      eval_duration?: number;
    };
    const content = data.message?.content;
    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return {
      patches: this.parseAndValidatePatches(content),
      usage: this.parseOllamaUsage(data)
    };
  }

  private buildConversationMessages(messages: ChatMessage[]): Array<{ role: CHAT_ROLE.USER | CHAT_ROLE.ASSISTANT; content: string }> {
    return messages
      .filter((message) => message.role === CHAT_ROLE.USER || message.role === CHAT_ROLE.ASSISTANT)
      .slice(-8)
      .map((message) => {
        if (message.role === CHAT_ROLE.ASSISTANT && message.patches) {
          return {
            role: CHAT_ROLE.ASSISTANT,
            content: `${message.content}\nPatches returned:\n${JSON.stringify(message.patches)}`
          };
        }

        return {
          role: message.role as CHAT_ROLE.USER | CHAT_ROLE.ASSISTANT,
          content: message.content
        };
      });
  }

  private parseAndValidatePatches(raw: string): UiPatch[] {
    const json = this.extractJsonArray(raw);
    const parsed = JSON.parse(json) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error("Model response must be a JSON array.");
    }

    const patches = parsed.filter((patch): patch is UiPatch => this.isUiPatch(patch));
    if (patches.length !== parsed.length) {
      throw new Error("Model returned one or more invalid patches.");
    }

    return patches;
  }

  private extractJsonArray(raw: string): string {
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start < 0 || end < start) {
      throw new Error("No JSON array found in model response.");
    }

    return raw.slice(start, end + 1);
  }

  private isUiPatch(value: unknown): value is UiPatch {
    if (!value || typeof value !== "object" || !("action" in value)) {
      return false;
    }

    const patch = value as Record<string, unknown>;

    if (patch.action === PatchAction.UpdateCss) {
      return (
        typeof patch.selector === "string" &&
        this.isStringRecord(patch.styles)
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

    if (patch.action === PatchAction.SetSectionLayout) {
      return (
        patch.layout === "two_column" &&
        this.isResumeSectionArray(patch.left) &&
        this.isResumeSectionArray(patch.right)
      );
    }

    return false;
  }

  private isResumeSectionArray(value: unknown): value is string[] {
    const allowedSections = new Set(["summary", "experience", "skills", "projects"]);
    return Array.isArray(value) && value.every((item) => typeof item === "string" && allowedSections.has(item));
  }

  private isStringRecord(value: unknown): value is Record<string, string> {
    return (
      !!value &&
      typeof value === "object" &&
      Object.values(value).every((item) => typeof item === "string")
    );
  }

  private parseOllamaUsage(data: {
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
  }): LlmUsage {
    return {
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      totalDuration: data.total_duration,
      loadDuration: data.load_duration,
      promptEvalDuration: data.prompt_eval_duration,
      evalDuration: data.eval_duration
    };
  }

  private buildSystemPrompt(allowedCssCustomProperties: string[], resumeStructure: string): string {
    const allowedTokenList = allowedCssCustomProperties.length
      ? allowedCssCustomProperties.map((property) => `- ${property}`).join("\n")
      : "- None";
    const structureDetails = resumeStructure.trim() || "No structure summary is available.";

    return `You convert a user's natural language page-editing instruction into JSON UI patches.

Return ONLY a valid JSON array. No markdown. No commentary.

Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
4. {"action":"remove_element","selector":"CSS selector"}
5. {"action":"set_section_layout","layout":"two_column","left":["skills"],"right":["experience"]}

The preview is a resume. Available page selectors:
${Object.values(RESUME_SELECTORS).map((selector) => `- ${selector}`).join("\n")}

Current resume top-level structure:
${structureDetails}

Rules:
- Do not return a full HTML document.
- Use the conversation history when the user refers to a previous request, correction, failed attempt, or says something like "not right", "did not work", or "没有实现".
- Prefer small, targeted patches.
- For requests that arrange resume sections beside each other, move a section left/right of another section, or create columns, prefer set_section_layout over update_css.
- Valid section ids for set_section_layout are summary, experience, skills, and projects.
- Use ${RESUME_SELECTORS.summaryText} only for the top resume summary paragraph. Use ${RESUME_SELECTORS.projectSummary} for project descriptions.
- Use only selectors that exist in the resume preview unless inserting into ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList}.
- For adding a skill, always use {"action":"insert_html","parent":"${RESUME_SELECTORS.skillsList}","position":"beforeend","html":"<li>Skill name</li>"}.
- For adding experience, insert an <article class="resume-item ${cls(RESUME_SELECTORS.experienceItem)}"> into ${RESUME_SELECTORS.experienceList}.
- For adding a project, insert an <article class="resume-item ${cls(RESUME_SELECTORS.projectItem)}"> into ${RESUME_SELECTORS.projectList}.
- For changing the resume accent color, update ${RESUME_SELECTORS.resume} with {"--accent-color":"color"}.
- Do not invent CSS custom properties. Only use CSS custom properties listed below:
${allowedTokenList}
- For layout changes, use real CSS properties such as display, grid-template-columns, width, max-width, margin, padding, gap, flex, or flex-wrap on existing selectors.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs.`;
  }
}

const defaultLlmService = new LlmService();

export async function getPatchesFromInstruction(
  instruction: string,
  provider: LlmProvider,
  model: string,
  backEndUrl: string,
  openAiApiKey: string,
  temperature: number,
  allowedCssCustomProperties: string[] = [],
  conversationHistory: ChatMessage[] = [],
  resumeStructure = "",
): Promise<PatchProviderResult> {
  return defaultLlmService.getPatchesFromInstruction({
    instruction,
    provider,
    model,
    backEndUrl,
    openAiApiKey,
    temperature,
    allowedCssCustomProperties,
    conversationHistory,
    resumeStructure
  });
}

export async function getPatchesFromOllama(
  instruction: string,
  model: string,
  backEndUrl: string,
  temperature: number,
  allowedCssCustomProperties: string[] = [],
  conversationHistory: ChatMessage[] = [],
  resumeStructure = "",
): Promise<PatchProviderResult> {
  return getPatchesFromInstruction(
    instruction,
    LlmProvider.Ollama,
    model,
    backEndUrl,
    "",
    temperature,
    allowedCssCustomProperties,
    conversationHistory,
    resumeStructure
  );
}

export async function checkOllamaHealth(
  backEndUrl: string,
  model: string,
  timeoutMs = 3000
): Promise<OllamaHealthResult> {
  return defaultLlmService.checkOllamaHealth(backEndUrl, model, timeoutMs);
}

export async function warmupOllama(backEndUrl: string, model: string, timeoutMs = 30000): Promise<boolean> {
  return defaultLlmService.warmupOllama(backEndUrl, model, timeoutMs);
}

export function getOllamaTagsUrl(backEndUrl: string): string {
  const url = new URL(backEndUrl);
  url.pathname = "/api/tags";
  url.search = "";
  url.hash = "";
  return url.toString();
}
