// SettingStore.ts

import { makeAutoObservable, observable } from "mobx";
import { DEFAULT_OLLAMA_MODEL, OLLAMA_URL } from "../constants";

export class SettingStore {
  llmName = DEFAULT_OLLAMA_MODEL
  backEndUrl = OLLAMA_URL
  temperature = 0.1

  constructor() {
    makeAutoObservable(this);
  }

  updateBackEndUrl(v: string){
    this.backEndUrl = v;
  }

  updateTemperature(v: number) {
    this.temperature = v;
  }
}
