import { LlmProvider, PatchAction } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import type { LlmConfig } from "./llm.config";
import { LlmProviderService } from "./llm-provider.service";
import { PatchWorkflowService } from "./llm.patch-workflow.service";
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

  it("delegates patch generation to PatchWorkflowService", async () => {
    const patchWorkflowService = {
      run: jest.fn().mockResolvedValue({
        patches: [],
        provider: LlmProvider.Ollama,
        model: "qwen2.5-coder:7b"
      })
    } as unknown as PatchWorkflowService;
    const request = {
      instruction: "Change title",
      resumeSummary: "Page 1"
    };
    const service = new LlmService(createConfig(), logger, new LlmProviderService(), patchWorkflowService);

    await expect(service.getPatchesFromInstruction(request, "request-delegate")).resolves.toEqual({
      patches: [],
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b"
    });
    expect(patchWorkflowService.run).toHaveBeenCalledWith(request, "request-delegate");
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
    const service = createService(logger);

    const result = await service.getPatchesFromInstruction(
      {
        instruction: "Change title",
        resumeSummary: "Page 1\n1. header.resume-header heading=\"Alex Morgan\"",
        resumeDom: "<main data-resume-root><article class=\"resume\">Full DOM text</article></main>"
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
    expect(body.messages[0].content).toContain("Current resume structured summary");
    expect(body.messages[0].content).toContain("Alex Morgan");
    expect(body.messages[0].content).not.toContain("Current resume full DOM");
    expect(body.messages[0].content).not.toContain("Full DOM text");
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
    expect(logger.info).toHaveBeenCalledWith("llm_request_started", expect.objectContaining({
      requestId: "request-1",
      usedFullDom: false,
      resumeSummaryLength: expect.any(Number),
      resumeDomLength: expect.any(Number)
    }));
  });

  it("includes full DOM for page translation and duplication requests", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify([
            {
              action: "clone_page",
              sourcePage: "1",
              targetPage: "2",
              targetLanguage: "zh-CN",
              textUpdates: [
                {
                  selector: ".resume-title",
                  text: "全栈工程师"
                }
              ]
            }
          ])
        }
      })
    } as Response);
    globalThis.fetch = fetchMock;
    const service = createService(logger);

    await service.getPatchesFromInstruction(
      {
        instruction: "Add a second page to be a chinese version one",
        resumeSummary: "Page 1\n1. header.resume-header heading=\"Alex Morgan\"",
        resumeDom: "<main data-resume-root><article class=\"resume\">Full DOM text</article></main>"
      },
      "request-2"
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("Current resume full DOM");
    expect(body.messages[0].content).toContain("Full DOM text");
    expect(body.messages[0].content).toContain('"action":"clone_page"');
    expect(body.messages[0].content).toContain('"textUpdates"');
    expect(body.messages[0].content).toContain("prefer clone_page over insert_html");
    expect(body.messages[0].content).toContain("clone_page may also refresh an existing target page");
    expect(body.messages[0].content).toContain("include textUpdates inside clone_page");
    expect(body.messages[0].content).toContain('parent "[data-resume-root]"');
    expect(body.messages[0].content).toContain("copy the source page DOM tree deeply");
    expect(body.messages[0].content).toContain("Never replace a non-empty source container with an empty target container");
    expect(body.messages[0].content).toContain("same structure");
    expect(logger.info).toHaveBeenCalledWith("llm_request_started", expect.objectContaining({
      requestId: "request-2",
      usedFullDom: true
    }));
  });

  it("ignores invalid model patches instead of failing the whole request", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify([
            {
              action: "updateText",
              selector: ".resume-title",
              text: "AI Engineer"
            },
            {
              action: "made_up_action",
              selector: ".resume-title",
              text: "Ignored"
            }
          ])
        }
      })
    } as Response);
    globalThis.fetch = fetchMock;
    const service = createService(logger);

    await expect(service.getPatchesFromInstruction(
      {
        instruction: "Change title",
        resumeSummary: "Page 1"
      },
      "request-invalid-patch"
    )).resolves.toMatchObject({
      patches: [
        {
          action: PatchAction.UpdateText,
          selector: ".resume-title",
          text: "AI Engineer"
        }
      ],
      note: "Ignored 1 invalid patch from the model."
    });
  });

  it("logs failed patch workflow requests", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500
    } as Response);
    globalThis.fetch = fetchMock;
    const service = createService(logger);

    await expect(service.getPatchesFromInstruction(
      {
        instruction: "Change title",
        resumeSummary: "Page 1"
      },
      "request-failed"
    )).rejects.toThrow("Ollama returned 500 from http://localhost:11434/api/chat.");

    expect(logger.error).toHaveBeenCalledWith("llm_request_failed", expect.objectContaining({
      requestId: "request-failed",
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b",
      error: "Ollama returned 500 from http://localhost:11434/api/chat."
    }));
  });

  it("falls back to legacy resumeStructure as the summary", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify([])
        }
      })
    } as Response);
    globalThis.fetch = fetchMock;
    const service = createService(logger);

    await service.getPatchesFromInstruction(
      {
        instruction: "Change title",
        resumeStructure: "Legacy structure summary"
      },
      "request-legacy"
    );

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("Legacy structure summary");
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
    const service = createService(logger);

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
    const service = createService(logger, {
      provider: LlmProvider.OpenAI,
      model: "gpt-4.1-mini",
      openAiApiKey: ""
    });

    await expect(service.getStatus()).resolves.toEqual({
      ok: false,
      provider: LlmProvider.OpenAI,
      model: "gpt-4.1-mini",
      reason: "missing_config",
      message: "OpenAI API key is required on the server."
    });
  });
});

function createService(
  logger: StructuredLogger,
  configOverrides: Partial<ReturnType<LlmConfig["getRuntimeConfig"]>> = {}
): LlmService {
  const config = createConfig(configOverrides);
  const providerService = new LlmProviderService();
  return new LlmService(
    config,
    logger,
    providerService,
    new PatchWorkflowService(config, logger, providerService)
  );
}

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
