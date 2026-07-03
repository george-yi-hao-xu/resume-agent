// ChatStore.ts

import { makeAutoObservable, runInAction } from "mobx";
import { llm } from "../services/llm";
import {
  CHAT_ROLE,
  PatchAction,
  type ChatMessage,
  type LlmUsage,
  type PatchResult,
} from "../types";
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
    "Change the title to AI Full-Stack Engineer",
    "Move the skills section to the left column",
    "Check the main layout to be 2-column grid layout",
    "Add a second page to be a chinese version one",
    "新的添加的第二页的内容要求复刻第一页的英文内容",
  ];

  constructor(
    private readonly resumeStore: ResumeStore,
    private readonly settingStore: SettingStore,
  ) {
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
    this.displayedResult = null;

    const conversationHistory = this.messages.slice();
    this.input = "";
    this.isWorking = true;
    this.messages.push({
      id: crypto.randomUUID(),
      role: CHAT_ROLE.USER,
      content: instruction,
    });

    try {
      const providerResult = await llm.getPatchesFromInstruction({
        instruction,
        allowedCssCustomProperties: this.resumeStore.allowedCssCustomProperties,
        conversationHistory,
        resumeSummary: this.resumeStore.resumeSummary,
        resumeDom: this.resumeStore.resumeDom
      });

      const patchResults = this.resumeStore.applyPatches(
        providerResult.patches,
      );

      runInAction(() => {
        this.results.push(...patchResults);
        this.messages.push({
          id: crypto.randomUUID(),
          role: CHAT_ROLE.ASSISTANT,
          provider: providerResult.provider,
          content: buildAssistantMessage(
            providerResult.provider,
            providerResult.model,
            providerResult.note,
          ),
          patches: providerResult.patches,
          usage: providerResult.usage,
        });
        this.lastUsage = providerResult.usage;
        this.displayedResult = patchResults;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Ollama request failed.";
      runInAction(() => {
        const failedRes = { ok: false, action: PatchAction.Ollama, message };
        this.results.push(failedRes);
        this.messages.push({
          id: crypto.randomUUID(),
          role: CHAT_ROLE.ASSISTANT,
          provider: this.settingStore.provider,
          content: `${this.settingStore.provider} request failed: ${message}`,
        });
        this.displayedResult = [failedRes];
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
      results: this.results,
    };
  }

  loadSnapshot(snapshot: ChatSnapshot): void {
    this.messages = snapshot.messages.length
      ? snapshot.messages
      : [this.createSystemMessage()];
    this.results = snapshot.results;
    this.displayedResult = null;
    this.input = "";
    this.isWorking = false;
    this.lastUsage = [...this.messages]
      .reverse()
      .find((message) => message.usage)?.usage;
  }

  private createSystemMessage(): ChatMessage {
    return {
      id: crypto.randomUUID(),
      role: CHAT_ROLE.SYSTEM,
      content: "The right side is the resume preview. The chat calls the Node.js LLM server to generate JSON patches.",
    };
  }
}

function buildAssistantMessage(
  provider: string,
  model?: string,
  note?: string,
): string {
  const source = `Generated patches with ${model ?? provider}.`;
  return note ? `${source} ${note}` : source;
}
