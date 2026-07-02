import { ChatStore } from "./ChatStore";
import { ResumeStore } from "./ResumeStore";
import { SettingStore } from "./SettingStore";

// Initialize all stores here on top of the App
export class RootStore {
  resumeStore: ResumeStore;
  chatStore: ChatStore;
  settingStore: SettingStore;

  constructor() {
    this.resumeStore = new ResumeStore();
    this.settingStore = new SettingStore();
    this.chatStore = new ChatStore(this.resumeStore, this.settingStore);
  }
}
