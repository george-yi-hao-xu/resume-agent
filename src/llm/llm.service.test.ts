import { LlmProvider, PatchAction } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import type { LlmConfig } from "./llm.config";
import { getOllamaChatUrl, getOllamaTagsUrl, LlmService } from "./llm.service";

describe("server LlmService", () => {
  const originalFetch = globalThis.fetch;
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as StructuredLogger;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("normalizes Ollama API URLs", () => {
    expect(getOllamaTagsUrl("http://localhost:11434/api/chat?x=1#hash")).toBe(
      "http://localhost:11434/api/tags"
    );
    expect(getOllamaChatUrl("http://localhost:11434")).toBe("http://localhost:11434/api/chat");
    expect(getOllamaChatUrl("http://localhost:11434/api/tags")).toBe("http://localhost:11434/api/chat");
  });

  it("calls Ollama and parses patches", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify([
            {
              action: "update_text",
              selector: ".resume-title",
              text: "AI Engineer"
            }
          ])
        },
        prompt_eval_count: 10,
        eval_count: 5
      })
    } as Response);
    globalThis.fetch = fetchMock;
    const service = new LlmService(createConfig(), logger);

    const result = await service.getPatchesFromInstruction(
      {
        instruction: "Change title",
        resumeStructure: "Page 1"
      },
      "request-1"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:11434/api/chat",
      expect.objectContaining({
        method: "POST"
      })
    );
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("Current resume top-level structure");
    expect(result).toMatchObject({
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b",
      patches: [
        {
          action: PatchAction.UpdateText,
          selector: ".resume-title",
          text: "AI Engineer"
        }
      ],
      usage: {
        promptEvalCount: 10,
        evalCount: 5
      }
    });
    expect(logger.info).toHaveBeenCalledWith("llm_request_completed", expect.objectContaining({
      requestId: "request-1",
      rawOutput: expect.any(String)
    }));
  });

  it("reports missing Ollama models with available model names", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: "llama3:latest"
          }
        ]
      })
    } as Response);
    globalThis.fetch = fetchMock;
    const service = new LlmService(createConfig(), logger);

    await expect(service.getStatus()).resolves.toEqual({
      ok: false,
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b",
      reason: "model_missing",
      message: "Model qwen2.5-coder:7b was not found.",
      availableModels: ["llama3:latest"]
    });
  });

  it("requires server OpenAI API key for OpenAI status", async () => {
    const service = new LlmService(createConfig({
      provider: LlmProvider.OpenAI,
      model: "gpt-4.1-mini",
      openAiApiKey: ""
    }), logger);

    await expect(service.getStatus()).resolves.toEqual({
      ok: false,
      provider: LlmProvider.OpenAI,
      model: "gpt-4.1-mini",
      reason: "missing_config",
      message: "OpenAI API key is required on the server."
    });
  });
});

function createConfig(overrides: Partial<ReturnType<LlmConfig["getRuntimeConfig"]>> = {}): LlmConfig {
  return {
    getRuntimeConfig: () => ({
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b",
      ollamaChatUrl: "http://localhost:11434/api/chat",
      openAiApiKey: "",
      temperature: 0.1,
      ...overrides
    })
  } as LlmConfig;
}
