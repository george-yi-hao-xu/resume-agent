import { ChatStore } from "./ChatStore";
import { LlmStatusStore } from "./LlmStatusStore";
import { ResumeStore } from "./ResumeStore";
import { SaveLoadStore } from "./SaveLoadStore";
import { SettingStore } from "./SettingStore";

// Initialize all stores here on top of the App
export class RootStore {
	resumeStore: ResumeStore;
	chatStore: ChatStore;
	settingStore: SettingStore;
	saveLoadStore: SaveLoadStore;
	llmStatusStore: LlmStatusStore;

	constructor() {
		this.resumeStore = new ResumeStore();
		this.settingStore = new SettingStore();
		this.chatStore = new ChatStore(this.resumeStore, this.settingStore);

		// manage save & load
		this.saveLoadStore = new SaveLoadStore(
			this.resumeStore,
			this.settingStore,
			this.chatStore,
		);
		this.llmStatusStore = new LlmStatusStore(this.settingStore);
	}
}
