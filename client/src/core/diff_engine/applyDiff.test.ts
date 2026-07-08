import { default_manifest } from "../default_manifest";
import { applyDiff } from "./applyDiff";

describe("applyDiff", () => {
	it("replaces text by node id", () => {
		const result = applyDiff(default_manifest, [
			{
				op: "test",
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Alex Chen",
			},
			{
				op: "replace",
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Taylor Morgan",
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(
			JSON.stringify(result.new),
		).toContain("Taylor Morgan");
	});

	it("inserts a safe node under a parent id", () => {
		const result = applyDiff(default_manifest, [
			{
				op: "add",
				path: "/tree/root/children/0/children/1/children/-",
				value: {
					type: "element",
					tagName: "p",
					attributes: { class: "summary-text" },
					children: [{ type: "text", value: "New summary line." }],
				},
			},
		]);

		expect(result.changed).toBe(true);
		expect(JSON.stringify(result.new)).toContain("New summary line.");
	});

	it("leaves the resume unchanged when any diff fails", () => {
		const result = applyDiff(default_manifest, [
			{
				op: "replace",
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Taylor Morgan",
			},
			{
				op: "remove",
				path: "/tree/root/children/999",
			},
		]);

		expect(result.changed).toBe(false);
		expect(result.results.some((item) => !item.ok)).toBe(true);
		expect(result.new).toEqual(default_manifest);
	});
});
