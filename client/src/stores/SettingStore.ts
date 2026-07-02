import { makeAutoObservable } from "mobx";
import { API_BASE_URL, DEFAULT_OLLAMA_MODEL } from "../constants";

export type SettingSnapshot = {
  llmName: string;
  backEndUrl: string;
  temperature: number;
};

export class SettingStore {
  llmName = DEFAULT_OLLAMA_MODEL;
  backEndUrl = API_BASE_URL;
  temperature = 0.1;

  constructor() {
    makeAutoObservable(this);
  }

  updateLlmName(value: string): void {
    this.llmName = value;
  }

  updateBackEndUrl(value: string): void {
    this.backEndUrl = value;
  }

  updateTemperature(value: number): void {
    this.temperature = Math.min(2, Math.max(0, value));
  }

  getSnapshot(): SettingSnapshot {
    return {
      llmName: this.llmName,
      backEndUrl: this.backEndUrl,
      temperature: this.temperature
    };
  }

  loadSnapshot(snapshot: SettingSnapshot): void {
    this.llmName = snapshot.llmName;
    this.backEndUrl = snapshot.backEndUrl;
    this.temperature = Math.min(2, Math.max(0, snapshot.temperature));
  }
}
