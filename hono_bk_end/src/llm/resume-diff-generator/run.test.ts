import { validate_diff_paths_for_resume } from "./path-validation.js";

describe("resume diff path validation", () => {
	it("accepts existing text wd value paths", () => {
		expect(() =>
			validate_diff_paths_for_resume(
				[
					{
						op: "replace",
						path: "/tree/root/children/0/children/0/value",
						value: "Interior Designer",
					},
				] as any,
				resumeFixture,
			),
		).not.toThrow();
	});

	it("rejects paths that are not in the resume wd index", () => {
		expect(() =>
			validate_diff_paths_for_resume(
				[
					{
						op: "replace",
						path: "/tree/root/children/0/children/1/children/2/children/0/value",
						value: "Interior Designer",
					},
				] as any,
				resumeFixture,
			),
		).toThrow("not present in valid resume wd paths");
	});
});

const resumeFixture = {
	wd: "/",
	styles: [],
	tree: {
		wd: "/tree",
		doctype: "html",
		root: {
			wd: "/tree/root",
			type: "element",
			tagName: "body",
			children: [
				{
					wd: "/tree/root/children/0",
					type: "element",
					tagName: "main",
					children: [
						{
							wd: "/tree/root/children/0/children/0",
							type: "text",
							value: "Full-Stack Engineer",
						},
					],
				},
			],
		},
	},
} as any;
