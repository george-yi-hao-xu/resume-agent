import type { Resume } from "@repo/schema";
import type { DiffIntentClassification } from "../intent-classifier.js";
import { build_relevant_nodes } from "./relevant-context.js";

describe("resume diff context nodes", () => {
	it("selects the page node for visual edits", () => {
		const nodes = build_relevant_nodes(
			resumeFixture,
			classification("visual", ["styles"]),
			"Make the resume a two-column grid layout",
		);

		expect(nodes).toHaveLength(1);
		expect(nodes[0].wd).toBe("/tree/root/children/0");
		expect(nodes[0].tagName).toBe("main");
	});

	it("selects matching sections for content edits", () => {
		const nodes = build_relevant_nodes(
			resumeFixture,
			classification("content", ["tree"]),
			"Rewrite the summary",
		);

		expect(nodes).toHaveLength(1);
		expect(nodes[0].wd).toBe("/tree/root/children/0/children/1");
		expect(JSON.stringify(nodes[0])).toContain("Product-minded engineer");
		expect(JSON.stringify(nodes[0])).not.toContain("TypeScript");
	});

	it("selects the source page for page clone translation", () => {
		const nodes = build_relevant_nodes(
			resumeFixture,
			classification("page_clone_translate", ["tree"]),
			"Add a second page as a Chinese translated version",
		);

		expect(nodes).toHaveLength(1);
		expect(nodes[0].wd).toBe("/tree/root/children/0");
		expect(JSON.stringify(nodes[0])).toContain("Product-minded engineer");
		expect(JSON.stringify(nodes[0])).toContain("TypeScript");
	});
});

function classification(
	intent: DiffIntentClassification["intent"],
	surfaces: DiffIntentClassification["surfaces"],
): DiffIntentClassification {
	return {
		intent,
		surfaces,
		confidence: 0.9,
		guidance: "Test guidance.",
		source: "llm",
	};
}

const resumeFixture: Resume = {
	wd: "/",
	styles: [
		{
			selector: ".resume",
			attributes: {
				display: "block",
			},
		},
	],
	tree: {
		wd: "/tree",
		doctype: "html",
		root: {
			wd: "/tree/root",
			type: "element",
			tagName: "body",
			attributes: { "data-resume-root": "" },
			children: [
				{
					wd: "/tree/root/children/0",
					type: "element",
					tagName: "main",
					attributes: { id: "page-01", class: "resume" },
					children: [
						{
							wd: "/tree/root/children/0/children/0",
							type: "element",
							tagName: "header",
							attributes: { class: "resume-header" },
							children: [
								{
									wd: "/tree/root/children/0/children/0/children/0",
									type: "element",
									tagName: "h1",
									attributes: { class: "resume-name" },
									children: [
										{
											wd: "/tree/root/children/0/children/0/children/0/children/0",
											type: "text",
											value: "Alex Chen",
										},
									],
								},
							],
						},
						{
							wd: "/tree/root/children/0/children/1",
							type: "element",
							tagName: "section",
							attributes: {
								class: "resume-section summary-section",
							},
							children: [
								{
									wd: "/tree/root/children/0/children/1/children/0",
									type: "element",
									tagName: "p",
									attributes: { class: "summary-text" },
									children: [
										{
											wd: "/tree/root/children/0/children/1/children/0/children/0",
											type: "text",
											value: "Product-minded engineer",
										},
									],
								},
							],
						},
						{
							wd: "/tree/root/children/0/children/2",
							type: "element",
							tagName: "section",
							attributes: {
								class: "resume-section skills-section",
							},
							children: [
								{
									wd: "/tree/root/children/0/children/2/children/0",
									type: "element",
									tagName: "ul",
									attributes: { class: "skills-list" },
									children: [
										{
											wd: "/tree/root/children/0/children/2/children/0/children/0",
											type: "element",
											tagName: "li",
											attributes: {},
											children: [
												{
													wd: "/tree/root/children/0/children/2/children/0/children/0/children/0",
													type: "text",
													value: "TypeScript",
												},
											],
										},
									],
								},
							],
						},
					],
				},
			],
		},
	},
};
