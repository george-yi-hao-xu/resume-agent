import { makeAutoObservable, runInAction } from "mobx";
import { DEFAULT_OLLAMA_MODEL } from "../constants";
import { getPatchesFromInstruction } from "../services/llm";
import { PatchAction, type ChatMessage, type PatchResult } from "../types";
import type { ResumeStore } from "./resumeStore";

export class ChatStore {
  input = "";
  isWorking = false;
  results: PatchResult[] = [];
  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "system",
      content: `The right side is the resume preview. The chat calls your local Ollama model ${DEFAULT_OLLAMA_MODEL} to generate JSON patches.`
    }
  ];

  readonly examples = [
    "Change the name to Grace Liu",
    "Change the title to AI Full-Stack Engineer",
    "Add Next.js to the skills",
    "Change the resume accent color to green"
  ];

  constructor(private readonly resumeStore: ResumeStore) {
    console.log("[ChatStore.constructor]");
    makeAutoObservable(this);
  }

  get canSubmit(): boolean {
    console.log("[ChatStore.canSubmit]", { inputLength: this.input.trim().length, isWorking: this.isWorking });
    return this.input.trim().length > 0 && !this.isWorking;
  }

  setInput(value: string): void {
    console.log("[ChatStore.setInput]", { value });
    this.input = value;
  }

  useExample(value: string): void {
    console.log("[ChatStore.useExample]", { value });
    this.input = value;
  }

  async submitInstruction(): Promise<void> {
    console.log("[ChatStore.submitInstruction:start]", { input: this.input });
    const instruction = this.input.trim();
    if (!instruction || this.isWorking) {
      console.log("[ChatStore.submitInstruction:skip]", { instruction, isWorking: this.isWorking });
      return;
    }

    this.input = "";
    this.isWorking = true;
    this.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: instruction
    });

    try {
      const providerResult = await getPatchesFromInstruction(instruction);
      console.log("[ChatStore.submitInstruction:patchesReceived]", providerResult);
      const patchResults = this.resumeStore.applyPatches(providerResult.patches);
      console.log("[ChatStore.submitInstruction:patchResults]", patchResults);

      runInAction(() => {
        console.log("[ChatStore.submitInstruction:successAction]");
        this.results = patchResults;
        this.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          provider: providerResult.provider,
          content: buildAssistantMessage(providerResult.provider, providerResult.model, providerResult.note),
          patches: providerResult.patches
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ollama request failed.";
      console.log("[ChatStore.submitInstruction:error]", { error, message });
      runInAction(() => {
        console.log("[ChatStore.submitInstruction:errorAction]");
        this.results = [{ ok: false, action: PatchAction.Ollama, message }];
        this.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          provider: "ollama",
          content: `Ollama request failed: ${message}`
        });
      });
    } finally {
      runInAction(() => {
        console.log("[ChatStore.submitInstruction:finallyAction]");
        this.isWorking = false;
      });
    }
  }
}

function buildAssistantMessage(provider: string, model?: string, note?: string): string {
  console.log("[buildAssistantMessage]", { provider, model, note });
  const source = `Generated patches with ${model ?? provider}.`;
  return note ? `${source} ${note}` : source;
}
