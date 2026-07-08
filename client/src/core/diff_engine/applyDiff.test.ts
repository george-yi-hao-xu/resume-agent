import { default_manifest } from "../default_manifest";
import { PatchAction } from "../../types";
import { applyDiff } from "./applyDiff";

describe("applyDiff", () => {
	it("replaces text by node id", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffTest,
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Alex Chen",
			},
			{
				op: PatchAction.DiffReplace,
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Taylor Morgan",
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(JSON.stringify(result.new)).toContain("Taylor Morgan");
	});

	it("inserts a safe node under a parent id", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffAdd,
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
		expect(result.results[0].action).toBe(PatchAction.DiffAdd);
	});

	it("inserts into an array at the end index", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffAdd,
				path: "/tree/root/children/0/children/1/children/1",
				value: {
					type: "element",
					tagName: "p",
					attributes: { class: "summary-text" },
					children: [
						{ type: "text", value: "Indexed summary line." },
					],
				},
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(JSON.stringify(result.new)).toContain("Indexed summary line.");
	});

	it("replaces a text node value when the diff targets the node", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffReplace,
				path: "/tree/root/children/0/children/2/children/1/children/0/children/0/children/0",
				value: "Interior Designer",
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(result.results[0].action).toBe(PatchAction.DiffReplace);
		expect(JSON.stringify(result.new)).toContain("Interior Designer");
	});

	it("normalizes element value paths to their single text child", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffReplace,
				path: "/tree/root/children/0/children/2/children/1/children/0/children/0/value",
				value: "Interior Designer",
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(result.results[0].message).toContain(
			"/tree/root/children/0/children/2/children/1/children/0/children/0/children/0/value",
		);
		expect(JSON.stringify(result.new)).toContain("Interior Designer");
	});

	it("updates node fields when the diff targets a node", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffReplace,
				path: "/tree/root/children/0/children/2",
				value: {
					attributes: {
						class: "resume-section updated-experience-section",
					},
				},
			},
		]);

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(JSON.stringify(result.new)).toContain(
			"updated-experience-section",
		);
		expect(JSON.stringify(result.new)).toContain("Experience");
	});

	it("removes a node from an array path", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffRemove,
				path: "/tree/root/children/0/children/3/children/1/children/0",
			},
		]);
		const firstSkill =
			result.new.tree.root.children?.[0].children?.[3].children?.[1]
				.children?.[0].children?.[0].value;

		expect(result.changed).toBe(true);
		expect(result.results.every((item) => item.ok)).toBe(true);
		expect(firstSkill).toBe("TypeScript");
	});

	it("leaves the resume unchanged when any diff fails", () => {
		const result = applyDiff(default_manifest, [
			{
				op: PatchAction.DiffReplace,
				path: "/tree/root/children/0/children/0/children/0/children/0/children/0/value",
				value: "Taylor Morgan",
			},
			{
				op: PatchAction.DiffRemove,
				path: "/tree/root/children/999",
			},
		]);

		expect(result.changed).toBe(false);
		expect(result.results.some((item) => !item.ok)).toBe(true);
		expect(result.results[1].action).toBe(PatchAction.DiffRemove);
		expect(result.new).toEqual(default_manifest);
	});
});
