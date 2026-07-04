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

export enum BackendStatus {
  Unknown = "unknown",
  Checking = "checking",
  Ready = "ready",
  Offline = "offline"
}

const LLM_STATUS_LABEL: Record<LlmStatus, string> = {
  [LlmStatus.Unknown]: "Unknown",
  [LlmStatus.Checking]: "Checking",
  [LlmStatus.Ready]: "Ready",
  [LlmStatus.Offline]: "Offline",
  [LlmStatus.ModelMissing]: "Missing model"
};

const BACKEND_STATUS_LABEL: Record<BackendStatus, string> = {
  [BackendStatus.Unknown]: "Unknown",
  [BackendStatus.Checking]: "Checking",
  [BackendStatus.Ready]: "Ready",
  [BackendStatus.Offline]: "Offline"
};

export class LlmStatusStore {
  backendStatus = BackendStatus.Unknown;
  backendMessage = "Backend status has not been checked.";
  llmStatus = LlmStatus.Unknown;
  llmMessage = "LLM status has not been checked.";

  private requestId = 0;
  private hasWarmedModel = false;

  constructor(_settingStore: SettingStore) {
    makeAutoObservable(this);
    void this.checkStatus();
  }

  get status(): LlmStatus {
    return this.llmStatus;
  }

  get message(): string {
    return this.llmMessage;
  }

  get label(): string {
    return this.llmLabel;
  }

  get backendLabel(): string {
    return BACKEND_STATUS_LABEL[this.backendStatus];
  }

  get llmLabel(): string {
    return LLM_STATUS_LABEL[this.llmStatus];
  }

  async checkStatus(): Promise<void> {
    const currentRequestId = ++this.requestId;
    this.backendStatus = BackendStatus.Checking;
    this.backendMessage = "Checking Node backend status.";
    this.llmStatus = LlmStatus.Unknown;
    this.llmMessage = "Waiting for backend status.";

    try {
      const health = await llm.getBackendHealth();
      if (currentRequestId !== this.requestId) {
        return;
      }

      if (!health.ok) {
        this.backendStatus = BackendStatus.Offline;
        this.backendMessage = "Backend health check did not return ok.";
        this.llmStatus = LlmStatus.Unknown;
        this.llmMessage = "LLM status was not checked because the backend is offline.";
        return;
      }

      this.backendStatus = BackendStatus.Ready;
      this.backendMessage = "Node backend is reachable.";
      this.llmStatus = LlmStatus.Checking;
      this.llmMessage = "Checking backend connection to LLM provider.";

      const result = await llm.getStatus();
      if (currentRequestId !== this.requestId) {
        return;
      }

      if (result.ok) {
        this.llmStatus = LlmStatus.Ready;
        this.llmMessage = result.message;
        this.warmupCurrentModel();
        return;
      }

      this.llmStatus = result.reason === "model_missing" ? LlmStatus.ModelMissing : LlmStatus.Offline;
      this.llmMessage = result.availableModels?.length
        ? `${result.message} Available models: ${result.availableModels.join(", ")}.`
        : result.message;
    } catch (error) {
      if (currentRequestId !== this.requestId) {
        return;
      }

      this.backendStatus = BackendStatus.Offline;
      this.backendMessage = error instanceof Error ? error.message : "Node backend is not reachable.";
      this.llmStatus = LlmStatus.Unknown;
      this.llmMessage = "LLM status was not checked because the backend is offline.";
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
