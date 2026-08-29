import { LlmProvider } from "@repo/schema";
import {
	extract_json,
	map_provider_usage,
	provider_name_to_enum,
} from "./llm-utils.js";

describe("llm-utils", () => {
	it("maps provider names to schema enums", () => {
		expect(provider_name_to_enum("openai")).toBe(LlmProvider.OpenAI);
		expect(provider_name_to_enum("ollama")).toBe(LlmProvider.Ollama);
		expect(provider_name_to_enum("custom")).toBe(LlmProvider.Ollama);
	});

	it("maps provider usage into existing response fields", () => {
		expect(
			map_provider_usage({
				promptTokens: 10,
				completionTokens: 20,
				totalDuration: 30,
			}),
		).toEqual({
			promptEvalCount: 10,
			evalCount: 20,
			totalDuration: 30,
			loadDuration: undefined,
			promptEvalDuration: undefined,
			evalDuration: undefined,
		});
	});

	it("extracts fenced JSON", () => {
		expect(extract_json('```json\n{"diffs":[]}\n```')).toBe(
			'{"diffs":[]}',
		);
	});

	it("prefers an array when the array starts before any object", () => {
		expect(extract_json('notes [{"op":"replace"}] trailing')).toBe(
			'[{"op":"replace"}]',
		);
	});

	it("extracts an object when an object starts before an array", () => {
		expect(extract_json('prefix {"diffs":[]} suffix')).toBe(
			'{"diffs":[]}',
		);
	});
});
