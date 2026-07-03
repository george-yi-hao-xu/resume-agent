import { makeAutoObservable } from "mobx";
import { llm } from "../services/llm";
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
  private hasWarmedModel = false;

  constructor(_settingStore: SettingStore) {
    makeAutoObservable(this);
    void this.checkStatus();
  }

  get label(): string {
    return LLM_STATUS_LABEL[this.status];
  }

  async checkStatus(): Promise<void> {
    const currentRequestId = ++this.requestId;
    this.status = LlmStatus.Checking;
    this.message = "Checking LLM server status.";

    try {
      const result = await llm.getStatus();
      if (currentRequestId !== this.requestId) {
        return;
      }

      if (result.ok) {
        this.status = LlmStatus.Ready;
        this.message = result.message;
        this.warmupCurrentModel();
        return;
      }

      this.status = result.reason === "model_missing" ? LlmStatus.ModelMissing : LlmStatus.Offline;
      this.message = result.availableModels?.length
        ? `${result.message} Available models: ${result.availableModels.join(", ")}.`
        : result.message;
    } catch (error) {
      if (currentRequestId !== this.requestId) {
        return;
      }

      this.status = LlmStatus.Offline;
      this.message = error instanceof Error ? error.message : "LLM server is not reachable.";
    }
  }

  dispose(): void {
    // No-op kept for RootStore lifecycle compatibility.
  }

  private warmupCurrentModel(): void {
    if (this.hasWarmedModel) {
      return;
    }

    this.hasWarmedModel = true;
    void llm.warmup();
  }
}
