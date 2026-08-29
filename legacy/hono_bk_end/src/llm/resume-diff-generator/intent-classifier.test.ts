import {
	classify_diff_intent,
	parse_diff_intent_classification,
} from "./intent-classifier.js";

describe("diff intent classifier", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		jest.restoreAllMocks();
		globalThis.fetch = originalFetch;
	});

	it("parses valid classifier JSON", () => {
		const result = parse_diff_intent_classification(
			JSON.stringify({
				intent: "mixed",
				surfaces: ["tree", "styles", "tree"],
				confidence: 0.86,
				guidance:
					"Use /tree for content changes and /styles for presentation.",
			}),
		);

		expect(result).toEqual({
			intent: "mixed",
			surfaces: ["tree", "styles"],
			confidence: 0.86,
			guidance:
				"Use /tree for content changes and /styles for presentation.",
			source: "llm",
		});
	});

	it("rejects unknown intents", () => {
		expect(() =>
			parse_diff_intent_classification(
				JSON.stringify({
					intent: "delete_everything",
					surfaces: ["tree"],
					confidence: 0.5,
					guidance: "Use /tree.",
				}),
			),
		).toThrow("Unsupported diff intent");
	});

	it("rejects invalid surfaces", () => {
		expect(() =>
			parse_diff_intent_classification(
				JSON.stringify({
					intent: "visual",
					surfaces: ["dom"],
					confidence: 0.5,
					guidance: "Use /styles.",
				}),
			),
		).toThrow("Unsupported intent surface");
	});

	it("falls back when the classifier returns invalid JSON", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				message: { content: "not json" },
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		const result = await classify_diff_intent({
			instruction: "双栏布局",
			model: "test-model",
			chatUrl: "http://localhost:11434/api/chat",
		});

		expect(result.source).toBe("fallback");
		expect(result.intent).toBe("ambiguous");
		expect(result.surfaces).toEqual(["styles", "tree"]);
		expect(result.guidance).toContain("visual/layout-only");
		expect(result.fallbackReason).toBeTruthy();
	});

	it("classifies common instruction categories from LLM JSON", async () => {
		const fetchMock = jest.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				message: {
					content: JSON.stringify({
						intent: "page_clone_translate",
						surfaces: ["tree"],
						confidence: 0.94,
						guidance:
							"Copy the existing page first, then replace copied text fields.",
					}),
				},
			}),
		} as Response);
		globalThis.fetch = fetchMock;

		const result = await classify_diff_intent({
			instruction: "复制一份中文翻译版到第二页",
			model: "test-model",
			chatUrl: "http://localhost:11434/api/chat",
		});

		expect(result).toMatchObject({
			intent: "page_clone_translate",
			surfaces: ["tree"],
			confidence: 0.94,
			source: "llm",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:11434/api/chat",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			}),
		);
	});
});
