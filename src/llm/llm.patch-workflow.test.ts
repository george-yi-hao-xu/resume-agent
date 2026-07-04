import { LlmProvider, PatchAction, type UiPatch } from "../../client/src/types";
import type { StructuredLogger } from "../logger/structured-logger";
import type { LlmRuntimeConfig } from "./llm.config";
import type { LlmProviderService } from "./llm-provider.service";
import {
  buildPatchResultStep,
  normalizePatchRequestStep,
  runPatchWorkflow,
  selectPatchContextStep,
  type PatchWorkflowContext,
  type PatchWorkflowState,
  type PatchWorkflowStep
} from "./llm.patch-workflow";
import type { GeneratePatchesRequest } from "./llm.types";

describe("patch workflow", () => {
  it("executes steps in order and carries state forward", async () => {
    const calls: string[] = [];
    const steps: PatchWorkflowStep[] = [
      (state) => {
        calls.push(`first:${state.requestId}`);
        return {
          ...state,
          resumeSummary: "summary"
        };
      },
      async (state) => {
        calls.push(`second:${state.resumeSummary}`);
        return {
          ...state,
          resumeDom: "dom"
        };
      }
    ];

    const finalState = await runPatchWorkflow(createState(), createContext(), steps);

    expect(calls).toEqual(["first:request-workflow", "second:summary"]);
    expect(finalState.resumeDom).toBe("dom");
  });

  it("selects full DOM context for translation and duplication requests", async () => {
    const state = await runPatchWorkflow(
      createState({
        instruction: "Add a second page to be a chinese version one",
        resumeDom: "<main data-resume-root>Full DOM text</main>"
      }),
      createContext(),
      [normalizePatchRequestStep, selectPatchContextStep]
    );

    expect(state.resumeDom).toBe("<main data-resume-root>Full DOM text</main>");
    expect(state.usedFullDom).toBe(true);
  });

  it("does not select full DOM context for simple text edits", async () => {
    const state = await runPatchWorkflow(
      createState({
        instruction: "Change title",
        resumeDom: "<main data-resume-root>Full DOM text</main>"
      }),
      createContext(),
      [normalizePatchRequestStep, selectPatchContextStep]
    );

    expect(state.usedFullDom).toBe(false);
  });

  it("builds patch provider results with invalid patch notes", () => {
    const patch: UiPatch = {
      action: PatchAction.UpdateText,
      selector: ".resume-title",
      text: "AI Engineer"
    };

    const state = buildPatchResultStep(
      {
        ...createState(),
        patches: [patch],
        usage: {
          promptEvalCount: 10
        },
        invalidPatchCount: 2
      },
      createContext()
    );

    expect(state.result).toEqual({
      patches: [patch],
      provider: LlmProvider.Ollama,
      model: "qwen2.5-coder:7b",
      usage: {
        promptEvalCount: 10
      },
      note: "Ignored 2 invalid patches from the model."
    });
  });
});

function createState(overrides: Partial<GeneratePatchesRequest> = {}): PatchWorkflowState {
  return {
    request: {
      instruction: "Change title",
      ...overrides
    },
    requestId: "request-workflow",
    startedAt: 100
  };
}

function createContext(): PatchWorkflowContext {
  return {
    config: createConfig(),
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as StructuredLogger,
    providerService: {
      callRaw: jest.fn()
    } as unknown as Pick<LlmProviderService, "callRaw">
  };
}

function createConfig(): LlmRuntimeConfig {
  return {
    provider: LlmProvider.Ollama,
    model: "qwen2.5-coder:7b",
    ollamaChatUrl: "http://localhost:11434/api/chat",
    openAiApiKey: "",
    temperature: 0.1
  };
}
