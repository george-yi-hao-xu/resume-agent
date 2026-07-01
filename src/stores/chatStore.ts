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

    this.input = "";
    this.isWorking = true;
    this.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: instruction
    });

    try {
      const providerResult = await getPatchesFromInstruction(instruction);
      const patchResults = this.resumeStore.applyPatches(providerResult.patches);

      runInAction(() => {
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
      runInAction(() => {
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
        this.isWorking = false;
      });
    }
  }
}

function buildAssistantMessage(provider: string, model?: string, note?: string): string {
  const source = `Generated patches with ${model ?? provider}.`;
  return note ? `${source} ${note}` : source;
}
