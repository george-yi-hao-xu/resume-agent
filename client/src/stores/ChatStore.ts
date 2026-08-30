// ChatStore.ts

import { makeAutoObservable, runInAction } from "mobx";
import { llm } from "../services/llm";
import type { ChatMessage, PatchResult, LlmUsage } from "@repo/schema";
import { CHAT_ROLE, PatchAction } from "@repo/schema";
import { createId } from "../core/utils";
import type { ResumeStore } from "./ResumeStore";
import type { SettingStore } from "./SettingStore";

export type ResumeEditMode = "diff";

export type ChatSnapshot = {
	messages: ChatMessage[];
	results: PatchResult[];
	editMode?: ResumeEditMode;
};

// Manage chat and trigger the message to LLM
export class ChatStore {
	input = "";
	isWorking = false;
	results: PatchResult[] = [];
	displayedResult: PatchResult[] | null = null;
	messages: ChatMessage[] = [];
	lastUsage?: LlmUsage;
	countDowns: Record<string, number> = {};
	editMode: ResumeEditMode = "diff";
	sessionId: string;

	private static readonly SESSION_ID_KEY = "agent-resume-session-id";

	readonly EXAMPLES = [
		"Change the job title to Interior Designer",
		"Move the skills section to the left column",
		"Change the main layout to be 2-column grid layout",
		"Add a second page, and make sure it to be a chinese version one",
		"新的添加的第二页的内容要求复刻第一页的英文内容",
	];

	constructor(
		private readonly resumeStore: ResumeStore,
		private readonly settingStore: SettingStore,
	) {
		this.sessionId = this.loadOrCreateSessionId();
		this.messages = [this.createSystemMessage()];
		makeAutoObservable(this);
	}

	private loadOrCreateSessionId(): string {
		try {
			const saved = localStorage.getItem(ChatStore.SESSION_ID_KEY);
			if (saved) {
				return saved;
			}
		} catch {
			// localStorage may be unavailable in some environments.
		}
		const id = createId("session");
		try {
			localStorage.setItem(ChatStore.SESSION_ID_KEY, id);
		} catch {
			// Ignore storage failures.
		}
		return id;
	}

	get canSubmit(): boolean {
		return this.input.trim().length > 0 && !this.isWorking;
	}

	setInput(value: string): void {
		this.input = value;
	}

	useExample(value: string): void {
		this.input = value;
	}

	clearDisplayedResult(v?: PatchResult): void {
		if (!v) {
			Object.values(this.countDowns).forEach((timeoutId) => {
				window.clearTimeout(timeoutId);
			});
			this.countDowns = {};
			this.displayedResult = null;
			return;
		}

		this.displayedResult =
			this.displayedResult?.filter((dr) => dr.message !== v.message) ??
			null;
		window.clearTimeout(this.countDowns[v.message]);
		delete this.countDowns[v.message];
	}

	setDisplayedResults(v: PatchResult[] | null) {
		this.displayedResult = v;
		console.log("-displayed: ", v);

		// count down
		v?.forEach((v) => {
			const t = window.setTimeout(() => {
				this.clearDisplayedResult(v);
			}, 5000);
			this.countDowns[v.message] = t;
		});
	}

	async submitInstruction(): Promise<void> {
		const instruction = this.input.trim();
		if (!instruction || this.isWorking) {
			return;
		}

		// clear results
		this.displayedResult = null;

		this.input = "";
		this.isWorking = true;
		const userMessage: ChatMessage = {
			id: createId("message"),
			role: CHAT_ROLE.USER,
			content: instruction,
		};
		this.messages.push(userMessage);

		try {
			const request = {
				instruction,
				allowClassNames: this.resumeStore.allowClassNames,
				conversationHistory: [this.messages[0], userMessage],
				resumeSummary: this.resumeStore.summaryDomStr,
				resumeDom: this.resumeStore.fullDomStr,
				sessionId: this.sessionId,
			};
			const providerResult =
				await llm.getResumeDiffFromInstruction(request);

			// Handle ambiguous intent clarification
			if (
				providerResult.diffs.length === 0 &&
				providerResult.note?.startsWith("clar_note:")
			) {
				const clarQuestion = providerResult.note.trim();
				runInAction(() => {
					this.messages.push({
						id: createId("message"),
						role: CHAT_ROLE.ASSISTANT,
						provider: providerResult.provider,
						content: clarQuestion,
						usage: providerResult.usage,
					});
					this.lastUsage = providerResult.usage;
				});
				return;
			}

			console.log("-Start applying DIFF", providerResult.diffs);
			const diffResults = this.resumeStore.applyDiff(
				providerResult.diffs,
			);

			runInAction(() => {
				this.results.push(...diffResults);
				this.messages.push({
					id: createId("message"),
					role: CHAT_ROLE.ASSISTANT,
					provider: providerResult.provider,
					content: buildAssistantMessage(
						providerResult.provider,
						providerResult.model,
						providerResult.note,
					),
					diffs: providerResult.diffs,
					usage: providerResult.usage,
				});
				this.lastUsage = providerResult.usage;
				this.setDisplayedResults(diffResults);
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Ollama request failed.";
			runInAction(() => {
				const failedRes = {
					ok: false,
					action: PatchAction.Unknown,
					message,
				};
				this.results.push(failedRes);
				this.messages.push({
					id: createId("message"),
					role: CHAT_ROLE.ASSISTANT,
					provider: this.settingStore.provider,
					content: `${this.settingStore.provider} request failed: ${message}`,
				});
				this.setDisplayedResults([failedRes]);
			});
		} finally {
			runInAction(() => {
				this.isWorking = false;
			});
		}
	}

	getSnapshot(): ChatSnapshot {
		return {
			messages: this.messages,
			results: this.results,
			editMode: this.editMode,
		};
	}

	loadSnapshot(snapshot: ChatSnapshot): void {
		this.messages = snapshot.messages.length
			? snapshot.messages
			: [this.createSystemMessage()];
		this.results = snapshot.results;
		this.displayedResult = null;
		this.input = "";
		this.isWorking = false;
		this.editMode = "diff";
		this.lastUsage = [...this.messages]
			.reverse()
			.find((message) => message.usage)?.usage;
		// A loaded snapshot starts a fresh session so that persisted backend
		// history does not bleed into the imported conversation.
		this.sessionId = createId("session");
		try {
			localStorage.setItem(ChatStore.SESSION_ID_KEY, this.sessionId);
		} catch {
			// Ignore storage failures.
		}
	}

	private createSystemMessage(): ChatMessage {
		return {
			id: createId("message"),
			role: CHAT_ROLE.SYSTEM,
			content:
				"The right side is the resume preview. The chat calls the Node.js LLM server to generate resume edits.",
		};
	}
}

function buildAssistantMessage(
	provider: string,
	model?: string,
	note?: string,
): string {
	const source = `Generated resume diffs with ${model ?? provider}.`;
	return note ? `${source} ${note}` : source;
}
