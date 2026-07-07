import { CHAT_ROLE, LlmProvider } from "../../client/src/types";
import { StructuredLogger } from "../logger/structured-logger";
import { LlmController } from "./llm.controller";
import { LlmService } from "./llm.service";

describe("LlmController", () => {
	it("logs inbound patch requests with a request id", async () => {
		const logger = createLogger();
		const llmService = {
			getPatchesFromInstruction: jest.fn().mockResolvedValue({
				patches: [],
				provider: LlmProvider.Ollama,
			}),
			getStatus: jest.fn(),
			warmupOllama: jest.fn(),
		} as unknown as LlmService;
		const controller = new LlmController(llmService, logger);

		await controller.getPatches(
			{
				instruction: "Change title",
				allowedCssCustomProperties: ["--accent-color"],
					conversationHistory: [
						{
							id: "message-1",
							role: CHAT_ROLE.USER,
							content: "Earlier request",
						},
					],
				resumeSummary: "Page 1",
				resumeDom: "<main data-resume-root></main>",
			},
			"request-1",
		);

		expect(logger.info).toHaveBeenCalledWith(
			"llm_request_received",
			expect.objectContaining({
				requestId: "request-1",
				instructionLength: "Change title".length,
				allowedCssCustomPropertiesCount: 1,
				conversationHistoryCount: 1,
				resumeSummaryLength: "Page 1".length,
				resumeDomLength: "<main data-resume-root></main>".length,
			}),
		);
		expect(llmService.getPatchesFromInstruction).toHaveBeenCalledWith(
			expect.objectContaining({
				instruction: "Change title",
			}),
			"request-1",
		);
	});
});

function createLogger(): StructuredLogger {
	return {
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	} as unknown as StructuredLogger;
}
