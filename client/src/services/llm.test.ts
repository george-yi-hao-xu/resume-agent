import { LlmProvider } from "../types";
import { llm } from "./llm";

describe("llm api client", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		jest.restoreAllMocks();
		globalThis.fetch = originalFetch;
	});

	it("requests resume diffs from the Node backend", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				provider: LlmProvider.Ollama,
				model: "glm4:latest",
				diffs: [
					{
						op: "replace",
						path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
						value: "AI Engineer",
					},
				],
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		const result = await llm.getResumeDiffFromInstruction({
			instruction: "Change title",
			allowClassNames: ["resume-title"],
			resumeDom: "{}",
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"/api/llm/resume-diff",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Content-Type": "application/json",
				}),
			}),
		);
		const [, init] = fetchMock.mock.calls[0];
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body).toMatchObject({
			instruction: "Change title",
			allowClassNames: ["resume-title"],
			resumeDom: "{}",
		});
		expect(JSON.stringify(body)).not.toContain("openAiApiKey");
		expect(JSON.stringify(body)).not.toContain("backEndUrl");
		expect(result.diffs).toEqual([
			{
				op: "replace",
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "AI Engineer",
			},
		]);
	});

	it("returns backend status", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				ok: true,
				provider: LlmProvider.Ollama,
				model: "glm4:latest",
				message: "glm4:latest is available.",
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		await expect(llm.getStatus()).resolves.toMatchObject({
			ok: true,
			provider: LlmProvider.Ollama,
		});
		expect(fetchMock).toHaveBeenCalledWith("/api/llm/status");
	});

	it("returns backend health", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				ok: true,
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		await expect(llm.getBackendHealth()).resolves.toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledWith("/api/health");
	});

	it("surfaces backend errors", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: false,
			status: 502,
			json: async () => ({
				message: "Ollama returned 404.",
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		await expect(
			llm.getResumeDiffFromInstruction({
				instruction: "Change title",
			}),
		).rejects.toThrow("Ollama returned 404.");
	});
});
