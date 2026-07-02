import { CHAT_ROLE, PatchAction } from "../types";
import { getOllamaTagsUrl, getPatchesFromInstruction, warmupOllama } from "./llm";

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

  it("sends recent conversation history with the current instruction", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: "[]" } })
    } as Response);
    globalThis.fetch = fetchMock;

    await getPatchesFromInstruction(
      "不对，没有实现",
      "qwen2.5-coder:7b",
      "http://localhost:11434/api/chat",
      0.1,
      ["--accent-color"],
      [
        {
          id: "1",
          role: CHAT_ROLE.USER,
          content: "把 skills 放到 experience 的左侧"
        },
        {
          id: "2",
          role: CHAT_ROLE.ASSISTANT,
          provider: "ollama",
          content: "Generated patches with qwen2.5-coder:7b.",
          patches: [
            {
              action: PatchAction.UpdateCss,
              selector: ".resume-header",
              styles: {
                display: "grid"
              }
            }
          ]
        }
      ],
      "1. header .resume-header\n2. section .experience-section \"Experience\"\n3. section .skills-section \"Skills\""
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as { messages: Array<{ role: string; content: string }> };

    expect(body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "user", content: "把 skills 放到 experience 的左侧" }),
        expect.objectContaining({ role: "user", content: "不对，没有实现" })
      ])
    );
    expect(body.messages[0].content).toContain("Current resume top-level structure");
    expect(body.messages.some((message) => message.content.includes("Patches returned"))).toBe(true);
  });
});
