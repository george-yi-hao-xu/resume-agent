import { getApiUrl } from "./llm";

describe("llm service", () => {
  it("builds backend endpoint URLs from the API base URL", () => {
    expect(getApiUrl("http://localhost:8000", "/api/patches").toString()).toBe("http://localhost:8000/api/patches");
  });

  it("handles base URLs with trailing slashes", () => {
    expect(getApiUrl("http://localhost:8000/", "/api/health").toString()).toBe("http://localhost:8000/api/health");
  });
});
