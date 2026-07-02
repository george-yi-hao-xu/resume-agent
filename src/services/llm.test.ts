import { getOllamaTagsUrl, warmupOllama } from "./llm";

describe("llm service", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("derives the Ollama tags URL from the chat URL", () => {
    expect(getOllamaTagsUrl("http://localhost:11434/api/chat")).toBe("http://localhost:11434/api/tags");
  });

  it("drops query strings and hashes from the tags URL", () => {
    expect(getOllamaTagsUrl("http://localhost:11434/api/chat?x=1#hash")).toBe(
      "http://localhost:11434/api/tags"
    );
  });

  it("warms Ollama with a lightweight chat request", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true } as Response);
    globalThis.fetch = fetchMock;

    await expect(warmupOllama("http://localhost:11434/api/chat", "qwen2.5-coder:7b")).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen2.5-coder:7b",
          stream: false,
          keep_alive: "10m",
          messages: [
            {
              role: "user",
              content: "ping"
            }
          ],
          options: {
            num_predict: 1,
            temperature: 0
          }
        })
      })
    );
  });
});
