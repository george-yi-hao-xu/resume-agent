import { apiUrl } from "./llm";

describe("llm service", () => {
  it("builds backend endpoint URLs from the API base URL", () => {
    expect(apiUrl("http://localhost:8000", "/api/patches")).toBe("http://localhost:8000/api/patches");
  });

  it("handles base URLs with trailing slashes", () => {
    expect(apiUrl("http://localhost:8000/", "/api/health")).toBe("http://localhost:8000/api/health");
  });
});
