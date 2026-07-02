import { getOllamaTagsUrl } from "./llm";

describe("llm service", () => {
  it("derives the Ollama tags URL from the chat URL", () => {
    expect(getOllamaTagsUrl("http://localhost:11434/api/chat")).toBe("http://localhost:11434/api/tags");
  });

  it("drops query strings and hashes from the tags URL", () => {
    expect(getOllamaTagsUrl("http://localhost:11434/api/chat?x=1#hash")).toBe(
      "http://localhost:11434/api/tags"
    );
  });
});
