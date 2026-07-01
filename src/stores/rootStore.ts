import { ChatStore } from "./chatStore";
import { ResumeStore } from "./resumeStore";

export class RootStore {
  resumeStore: ResumeStore;
  chatStore: ChatStore;

  constructor() {
    this.resumeStore = new ResumeStore();
    this.chatStore = new ChatStore(this.resumeStore);
  }
}
