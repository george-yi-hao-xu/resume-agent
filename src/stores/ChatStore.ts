// ChatStore.ts

import { makeAutoObservable, runInAction } from "mobx";
import { getPatchesFromInstruction } from "../services/llm";
import { CHAT_ROLE, PatchAction, type ChatMessage, type LlmUsage, type PatchResult } from "../types";
import type { ResumeStore } from "./ResumeStore";
import { SettingStore } from "./SettingStore";

export type ChatSnapshot = {
  messages: ChatMessage[];
  results: PatchResult[];
};

// Manage chat and trigger the message to LLM
export class ChatStore {
  input = "";
  isWorking = false;
  results: PatchResult[] = [];
  displayedResult: PatchResult[] | null = null;
  messages: ChatMessage[] = [];
  lastUsage?: LlmUsage;

  readonly EXAMPLES = [
    "Change the name to Grace Liu",
    "Change the title to AI Full-Stack Engineer",
    "Add Next.js to the skills",
    "Change the resume accent color to green"
  ];

  constructor(private readonly resumeStore: ResumeStore, private readonly settingStore: SettingStore) {
    this.messages = [this.createSystemMessage()];
    makeAutoObservable(this);
  }

  get canSubmit(): boolean {
    return this.input.trim().length > 0 && !this.isWorking;
  }

  setInput(value: string): void {
    this.input = value;
  }

  useExample(value: string): void {
    this.input = value;
  }

  async submitInstruction(): Promise<void> {
    const instruction = this.input.trim();
    if (!instruction || this.isWorking) {
      return;
    }

    // clear results
    this.displayedResult = null

    const conversationHistory = this.messages.slice();
    this.input = "";
    this.isWorking = true;
    this.messages.push({
      id: crypto.randomUUID(),
      role: CHAT_ROLE.USER,
      content: instruction
    });

    try {
      const providerResult = await getPatchesFromInstruction(
        instruction,
        this.settingStore.provider,
        this.settingStore.llmName,
        this.settingStore.backEndUrl,
        this.settingStore.openAiApiKey,
        this.settingStore.temperature,
        this.resumeStore.allowedCssCustomProperties,
        conversationHistory,
        this.resumeStore.structureSummary
      );
      const patchResults = this.resumeStore.applyPatches(providerResult.patches);

      runInAction(() => {
        this.results.push(...patchResults);
        this.messages.push({
          id: crypto.randomUUID(),
          role: CHAT_ROLE.ASSISTANT,
          provider: providerResult.provider,
          content: buildAssistantMessage(providerResult.provider, providerResult.model, providerResult.note),
          patches: providerResult.patches,
          usage: providerResult.usage
        });
        this.lastUsage = providerResult.usage;
        this.displayedResult = patchResults;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ollama request failed.";
      runInAction(() => {
        const failedRes = { ok: false, action: PatchAction.Ollama, message };
        this.results.push(failedRes);
        this.messages.push({
          id: crypto.randomUUID(),
          role: CHAT_ROLE.ASSISTANT,
          provider: this.settingStore.provider,
          content: `${this.settingStore.provider} request failed: ${message}`
        });
        this.displayedResult = [failedRes]
      });
    } finally {
      runInAction(() => {
        this.isWorking = false;
      });
    }
  }

  getSnapshot(): ChatSnapshot {
    return {
      messages: this.messages,
      results: this.results
    };
  }

  loadSnapshot(snapshot: ChatSnapshot): void {
    this.messages = snapshot.messages.length ? snapshot.messages : [this.createSystemMessage()];
    this.results = snapshot.results;
    this.displayedResult = null;
    this.input = "";
    this.isWorking = false;
    this.lastUsage = [...this.messages].reverse().find((message) => message.usage)?.usage;
  }

  private createSystemMessage(): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: CHAT_ROLE.SYSTEM,
      content: `The right side is the resume preview. The chat calls your local Ollama model ${this.settingStore.llmName} to generate JSON patches.`
    };
  }
}

function buildAssistantMessage(provider: string, model?: string, note?: string): string {
  const source = `Generated patches with ${model ?? provider}.`;
  return note ? `${source} ${note}` : source;
}
