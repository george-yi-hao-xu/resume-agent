import { LlmProvider } from "../types";
import { BackendStatus, LlmStatus, LlmStatusStore } from "./LlmStatusStore";
import { SettingStore } from "./SettingStore";

describe("LlmStatusStore", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		jest.restoreAllMocks();
		globalThis.fetch = originalFetch;
	});

	it("tracks backend and LLM status separately", async () => {
		const fetchMock = jest.fn().mockImplementation((url: string) => {
			if (url === "/api/health" || url === "/api/llm/warmup") {
				return Promise.resolve({
					ok: true,
					json: async () => ({ ok: true }),
				} as Response);
			}

			return Promise.resolve({
				ok: true,
				json: async () => ({
					ok: true,
					provider: LlmProvider.Ollama,
					model: "qwen2.5-coder:7b",
					message: "qwen2.5-coder:7b is available.",
				}),
			} as Response);
		});
		globalThis.fetch = fetchMock;

		const store = new LlmStatusStore(new SettingStore());
		await store.checkStatus();

		expect(store.backendStatus).toBe(BackendStatus.Ready);
		expect(store.backendMessage).toBe("Node backend is reachable.");
		expect(store.llmStatus).toBe(LlmStatus.Ready);
		expect(store.llmMessage).toBe("qwen2.5-coder:7b is available.");
		expect(fetchMock).toHaveBeenCalledWith("/api/health");
		expect(fetchMock).toHaveBeenCalledWith("/api/llm/status");
	});

	it("does not check LLM status when backend is offline", async () => {
		const fetchMock = jest
			.fn()
			.mockRejectedValue(new Error("Network error"));
		globalThis.fetch = fetchMock;

		const store = new LlmStatusStore(new SettingStore());
		await store.checkStatus();

		expect(store.backendStatus).toBe(BackendStatus.Offline);
		expect(store.backendMessage).toBe("Network error");
		expect(store.llmStatus).toBe(LlmStatus.Unknown);
		expect(store.llmMessage).toBe(
			"LLM status was not checked because the backend is offline.",
		);
		expect(fetchMock).toHaveBeenCalledWith("/api/health");
		expect(fetchMock).not.toHaveBeenCalledWith("/api/llm/status");
	});
});
