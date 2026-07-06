import { LlmProvider, PatchAction } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import type { LlmConfig } from "./llm.config";
import { LlmProviderService } from "./llm-provider.service";
import { PatchWorkflowService } from "./llm.patch-workflow.service";

describe("PatchWorkflowService", () => {
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

  it("runs the patch workflow and returns parsed patches", async () => {
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
    const service = createPatchWorkflowService(logger);

    await expect(service.run(
      {
        instruction: "Change title",
        resumeSummary: "Page 1"
      },
      "request-workflow-service"
    )).resolves.toMatchObject({
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

    expect(logger.info).toHaveBeenCalledWith("llm_request_started", expect.objectContaining({
      requestId: "request-workflow-service",
      usedFullDom: false
    }));
    expect(logger.info).toHaveBeenCalledWith("llm_request_completed", expect.objectContaining({
      requestId: "request-workflow-service",
      rawOutput: expect.any(String)
    }));
  });

  it("logs failed patch workflow requests", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500
    } as Response);
    globalThis.fetch = fetchMock;
    const service = createPatchWorkflowService(logger);

    await expect(service.run(
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
});

function createPatchWorkflowService(
  logger: StructuredLogger,
  configOverrides: Partial<ReturnType<LlmConfig["getRuntimeConfig"]>> = {}
): PatchWorkflowService {
  return new PatchWorkflowService(createConfig(configOverrides), logger, new LlmProviderService());
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
