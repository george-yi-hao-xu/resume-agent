import { makeAutoObservable, observable, runInAction } from "mobx";
import { DEFAULT_OLLAMA_MODEL, getPatchesFromInstruction } from "../services/llm";
import { applyPatches } from "../core/patchEngine";
import { initialPreviewHtml } from "../components/previewHtml";
import type { ChatMessage, PatchResult } from "../types";

export class EditorStore {
  input = "";
  isWorking = false;
  previewDocument?: Document;
  results: PatchResult[] = [];
  messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "system",
      content: `右侧是简历预览。使用 Ollama 模型 ${DEFAULT_OLLAMA_MODEL}，不可用时会尝试 llama3，然后回退到 mock patches。`
    }
  ];

  readonly examples = [
    "把名字改成 Grace Liu",
    "把职位改成 AI Full-Stack Engineer",
    "给技能添加 Next.js",
    "把简历强调色改成绿色"
  ];

  constructor() {
    makeAutoObservable(this, {
      previewDocument: observable.ref
    });
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

  initializePreview(frame: HTMLIFrameElement | null): void {
    if (frame) {
      frame.srcdoc = initialPreviewHtml;
    }
  }

  setPreviewDocument(doc: Document | undefined): void {
    this.previewDocument = doc;
  }

  async submitInstruction(): Promise<void> {
    const instruction = this.input.trim();
    if (!instruction || this.isWorking) {
      return;
    }

    this.input = "";
    this.isWorking = true;
    this.messages.push({
      id: crypto.randomUUID(),
      role: "user",
      content: instruction
    });

    try {
      const providerResult = await getPatchesFromInstruction(instruction);
      const patchResults = this.previewDocument
        ? applyPatches(this.previewDocument, providerResult.patches)
        : [{ ok: false, action: "preview", message: "Preview iframe is not ready." }];

      runInAction(() => {
        this.results = patchResults;
        this.messages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          provider: providerResult.provider,
          content: buildAssistantMessage(providerResult.provider, providerResult.model, providerResult.note),
          patches: providerResult.patches
        });
      });
    } finally {
      runInAction(() => {
        this.isWorking = false;
      });
    }
  }
}

function buildAssistantMessage(provider: string, model?: string, note?: string): string {
  const source = provider === "ollama" ? `Generated patches with ${model}.` : "Generated patches with mock fallback.";
  return note ? `${source} ${note}` : source;
}
