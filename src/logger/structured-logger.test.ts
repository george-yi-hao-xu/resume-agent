import { StructuredLogger } from "./structured-logger";

describe("StructuredLogger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("redacts secret-looking fields and values", () => {
    const consoleSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = new StructuredLogger();

    logger.info("test_event", {
      openAiApiKey: "sk-secret",
      authorization: "Bearer abc.def",
      rawOutput: "token sk-another-secret"
    });

    const payload = JSON.parse(consoleSpy.mock.calls[0][0]) as Record<string, unknown>;
    expect(payload).toMatchObject({
      level: "info",
      event: "test_event",
      openAiApiKey: "[REDACTED]",
      authorization: "[REDACTED]",
      rawOutput: "token [REDACTED]"
    });
  });
});
