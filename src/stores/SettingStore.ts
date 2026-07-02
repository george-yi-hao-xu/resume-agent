import { makeAutoObservable } from "mobx";
import { DEFAULT_OLLAMA_MODEL, OLLAMA_URL } from "../constants";

export class SettingStore {
  llmName = DEFAULT_OLLAMA_MODEL;
  backEndUrl = OLLAMA_URL;
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
}
