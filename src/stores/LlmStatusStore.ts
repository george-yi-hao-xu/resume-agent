import { makeAutoObservable, reaction, type IReactionDisposer } from "mobx";
import { checkOllamaHealth, warmupOllama } from "../services/llm";
import type { SettingStore } from "./SettingStore";
import { LlmProvider } from "../types";

export enum LlmStatus {
  Unknown = "unknown",
  Checking = "checking",
  Ready = "ready",
  Offline = "offline",
  ModelMissing = "model_missing"
}

const LLM_STATUS_LABEL: Record<LlmStatus, string> = {
  [LlmStatus.Unknown]: "Unknown",
  [LlmStatus.Checking]: "Checking",
  [LlmStatus.Ready]: "Ready",
  [LlmStatus.Offline]: "Offline",
  [LlmStatus.ModelMissing]: "Missing model"
};

export class LlmStatusStore {
  status = LlmStatus.Unknown;
  message = "LLM status has not been checked.";

  private requestId = 0;
  private hasWarmedModel = false;
  disposeSettingsReaction: IReactionDisposer;

  constructor(private readonly settingStore: SettingStore) {
    makeAutoObservable(this, {
      disposeSettingsReaction: false
    });

    this.disposeSettingsReaction = reaction(
      () => [this.settingStore.provider, this.settingStore.backEndUrl, this.settingStore.llmName, this.settingStore.openAiApiKey],
      () => {
        this.hasWarmedModel = false;
        void this.checkStatus();
      },
      { delay: 300 }
    );

    void this.checkStatus();
  }

  get label(): string {
    return LLM_STATUS_LABEL[this.status];
  }

  async checkStatus(): Promise<void> {
    const currentRequestId = ++this.requestId;
    this.status = LlmStatus.Checking;
    this.message = `Checking ${this.settingStore.provider} status.`;

    if (this.settingStore.provider === LlmProvider.OpenAI) {
      if (!this.settingStore.openAiApiKey) {
        this.status = LlmStatus.Offline;
        this.message = "OpenAI API key is required.";
        return;
      }

      this.status = LlmStatus.Ready;
      this.message = `${this.settingStore.llmName} is configured.`;
      return;
    }

    const result = await checkOllamaHealth(this.settingStore.backEndUrl, this.settingStore.llmName);
    if (currentRequestId !== this.requestId) {
      return;
    }

    if (result.ok) {
      this.status = LlmStatus.Ready;
      this.message = `${this.settingStore.llmName} is available.`;
      this.warmupCurrentModel();
      return;
    }

    this.status = result.reason === "model_missing" ? LlmStatus.ModelMissing : LlmStatus.Offline;
    this.message = result.message;
  }

  dispose(): void {
    this.disposeSettingsReaction();
  }

  private warmupCurrentModel(): void {
    if (this.hasWarmedModel) {
      return;
    }

    this.hasWarmedModel = true;
    void warmupOllama(this.settingStore.backEndUrl, this.settingStore.llmName);
  }
}
