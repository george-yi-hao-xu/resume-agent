import { CHAT_ROLE, LlmProvider, PatchAction } from "../types";
import { llm } from "./llm";

describe("llm api client", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("requests patches from the Node backend without provider secrets", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: LlmProvider.Ollama,
        model: "qwen2.5-coder:7b",
        patches: [],
        usage: {
          promptEvalCount: 321,
          evalCount: 12
        }
      })
    } as Response);
    globalThis.fetch = fetchMock;

    const result = await llm.getPatchesFromInstruction({
      instruction: "不对，没有实现",
      allowedCssCustomProperties: ["--accent-color"],
      conversationHistory: [
        {
          id: "1",
          role: CHAT_ROLE.USER,
          content: "把 skills 放到 experience 的左侧"
        }
      ],
      resumeSummary: "Page 1",
      resumeDom: "<main data-resume-root></main>"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/llm/patches",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json"
        })
      })
    );
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      instruction: "不对，没有实现",
      allowedCssCustomProperties: ["--accent-color"],
      conversationHistory: [
        {
          id: "1",
          role: CHAT_ROLE.USER,
          content: "把 skills 放到 experience 的左侧"
        }
      ],
      resumeSummary: "Page 1",
      resumeDom: "<main data-resume-root></main>"
    });
    expect(JSON.stringify(body)).not.toContain("openAiApiKey");
    expect(JSON.stringify(body)).not.toContain("backEndUrl");
    expect(result.usage).toMatchObject({
      promptEvalCount: 321,
      evalCount: 12
    });
  });

  it("returns backend status", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        provider: LlmProvider.Ollama,
        model: "qwen2.5-coder:7b",
        message: "qwen2.5-coder:7b is available."
      })
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(llm.getStatus()).resolves.toMatchObject({
      ok: true,
      provider: LlmProvider.Ollama
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/llm/status");
  });

  it("returns backend health", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true
      })
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
        message: "Ollama returned 404."
      })
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(
      llm.getPatchesFromInstruction({
        instruction: "Change title"
      })
    ).rejects.toThrow("Ollama returned 404.");
  });

  it("keeps parsed patch payloads unchanged", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: LlmProvider.Ollama,
        model: "qwen2.5-coder:7b",
        patches: [
          {
            action: PatchAction.UpdateText,
            selector: ".resume-title",
            text: "AI Engineer"
          }
        ]
      })
    } as Response);
    globalThis.fetch = fetchMock;

    await expect(
      llm.getPatchesFromInstruction({
        instruction: "Change title"
      })
    ).resolves.toMatchObject({
      patches: [
        {
          action: PatchAction.UpdateText,
          selector: ".resume-title",
          text: "AI Engineer"
        }
      ]
    });
  });
});
