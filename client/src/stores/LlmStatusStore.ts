import { makeAutoObservable, reaction, type IReactionDisposer } from "mobx";
import { checkOllamaHealth } from "../services/llm";
import type { SettingStore } from "./SettingStore";

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
  disposeSettingsReaction: IReactionDisposer;

  constructor(private readonly settingStore: SettingStore) {
    makeAutoObservable(this, {
      disposeSettingsReaction: false
    });

    this.disposeSettingsReaction = reaction(
      () => [this.settingStore.backEndUrl, this.settingStore.llmName],
      () => {
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
    this.message = "Checking backend status.";

    const result = await checkOllamaHealth(this.settingStore.backEndUrl, this.settingStore.llmName);
    if (currentRequestId !== this.requestId) {
      return;
    }

    if (result.ok) {
      this.status = LlmStatus.Ready;
      this.message = `${this.settingStore.llmName} is available.`;
      return;
    }

    this.status = result.reason === "model_missing" ? LlmStatus.ModelMissing : LlmStatus.Offline;
    this.message = result.message;
  }

  dispose(): void {
    this.disposeSettingsReaction();
  }
}
