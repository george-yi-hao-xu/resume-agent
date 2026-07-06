import { Resume } from "../resume.types";

export const default_manifest: Resume = {
	styles: [
		{
			selector: "*",
			attributes: {
				"box-sizing": "border-box",
			},
		},
		{
			selector: "body",
			attributes: {
				margin: "0",
				color: "#1f2937",
				"font-family":
					'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
				background: "#e5e7eb",
			},
		},
		{
			selector: ".vertical",
			attributes: {
				display: "flex",
				"flex-direction": "column",
			},
		},
		{
			selector: ".horizontal",
			attributes: {
				display: "flex",
				"flex-direction": "row",
			},
		},
		{
			selector: ".resume",
			attributes: {
				"--accent-color": "#2563eb",
				width: "min(900px, calc(100vw - 48px))",
				"min-height": "1120px",
				margin: "32px auto",
				padding: "56px",
				background: "#ffffff",
				"box-shadow": "0 24px 70px rgba(31, 41, 55, 0.16)",
			},
		},
		{
			selector: ".resume-header",
			attributes: {
				display: "grid",
				"grid-template-columns": "1fr auto",
				gap: "24px",
				"align-items": "start",
				"padding-bottom": "28px",
				"border-bottom": "2px solid var(--accent-color)",
			},
		},
		{
			selector: ".resume-name",
			attributes: {
				margin: "0",
				color: "#111827",
				"font-size": "42px",
				"line-height": "1",
				"letter-spacing": "0",
			},
		},
		{
			selector: ".resume-title",
			attributes: {
				margin: "10px 0 0",
				color: "var(--accent-color)",
				"font-size": "18px",
				"font-weight": "800",
			},
		},
		{
			selector: ".contact-list",
			attributes: {
				display: "grid",
				gap: "7px",
				margin: "0",
				color: "#4b5563",
				"font-size": "13px",
				"text-align": "right",
			},
		},
		{
			selector: ".resume-section",
			attributes: {
				padding: "26px 0 0",
			},
		},
		{
			selector: ".section-title",
			attributes: {
				margin: "0 0 14px",
				color: "#111827",
				"font-size": "13px",
				"font-weight": "900",
				"letter-spacing": "0",
				"text-transform": "uppercase",
			},
		},
		{
			selector: ".summary-text, .project-summary",
			attributes: {
				margin: "0",
				color: "#374151",
				"font-size": "16px",
				"line-height": "1.65",
			},
		},
		{
			selector: ".experience-list, .project-list",
			attributes: {
				display: "grid",
				gap: "20px",
			},
		},
		{
			selector: ".resume-item h3",
			attributes: {
				margin: "0",
				color: "#111827",
				"font-size": "18px",
			},
		},
		{
			selector: ".resume-meta",
			attributes: {
				margin: "5px 0 10px",
				color: "#6b7280",
				"font-size": "13px",
				"font-weight": "700",
			},
		},
		{
			selector: ".bullet-list",
			attributes: {
				margin: "0",
				"padding-left": "20px",
				color: "#374151",
				"line-height": "1.55",
			},
		},
		{
			selector: ".skills-list",
			attributes: {
				display: "flex",
				"flex-wrap": "wrap",
				gap: "8px",
				margin: "0",
				padding: "0",
				"list-style": "none",
			},
		},
		{
			selector: ".skills-list li",
			attributes: {
				border: "1px solid #d1d5db",
				"border-radius": "999px",
				padding: "7px 10px",
				color: "#1f2937",
				background: "#f9fafb",
				"font-size": "13px",
				"font-weight": "700",
			},
		},
		{
			media: "(max-width: 720px)",
			rules: [
				{
					selector: ".resume",
					attributes: {
						width: "100%",
						"min-height": "100vh",
						margin: "0",
						padding: "28px",
						"box-shadow": "none",
					},
				},
				{
					selector: ".resume-header",
					attributes: {
						"grid-template-columns": "1fr",
					},
				},
				{
					selector: ".contact-list",
					attributes: {
						"text-align": "left",
					},
				},
				{
					selector: ".resume-name",
					attributes: {
						"font-size": "34px",
					},
				},
			],
		},
		{
			atRule: "@page",
			attributes: {
				size: "A4",
				margin: "0",
			},
		},
		{
			media: "print",
			rules: [
				{
					selector: "html, body",
					attributes: {
						width: "210mm",
						"min-height": "297mm",
						background: "#ffffff",
					},
				},
				{
					selector: ".resume",
					attributes: {
						width: "210mm",
						"min-height": "297mm",
						margin: "0",
						"box-shadow": "none",
					},
				},
			],
		},
	],
	tree: {
		doctype: "html",
		root: {
			type: "element",
			tagName: "html",
			attributes: {
				lang: "en",
			},
			children: [
				{
					type: "element",
					tagName: "head",
					attributes: {},
					children: [
						{
							type: "element",
							tagName: "meta",
							attributes: {
								charset: "UTF-8",
							},
							children: [],
						},
						{
							type: "element",
							tagName: "meta",
							attributes: {
								name: "viewport",
								content:
									"width=device-width, initial-scale=1.0",
							},
							children: [],
						},
						{
							type: "element",
							tagName: "style",
							attributes: {},
							children: [],
						},
					],
				},
				{
					type: "element",
					tagName: "body",
					attributes: {
						"data-resume-root": "",
						class: "[data-resume-root]",
					},
					children: [
						{
							type: "element",
							tagName: "main",
							attributes: {
								id: "page-01",
								class: "resume",
							},
							children: [
								{
									type: "element",
									tagName: "header",
									attributes: {
										class: "resume-header",
									},
									children: [
										{
											type: "element",
											tagName: "div",
											attributes: {},
											children: [
												{
													type: "element",
													tagName: "h1",
													attributes: {
														class: "resume-name",
													},
													children: [
														{
															type: "text",
															value: "Alex Chen",
														},
													],
												},
												{
													type: "element",
													tagName: "p",
													attributes: {
														class: "resume-title",
													},
													children: [
														{
															type: "text",
															value: "Full-Stack Engineer",
														},
													],
												},
											],
										},
										{
											type: "element",
											tagName: "address",
											attributes: {
												class: "contact-list",
											},
											children: [
												{
													type: "element",
													tagName: "span",
													attributes: {
														class: "contact-email",
													},
													children: [
														{
															type: "text",
															value: "alex.chen@example.com",
														},
													],
												},
												{
													type: "element",
													tagName: "span",
													attributes: {
														class: "contact-phone",
													},
													children: [
														{
															type: "text",
															value: "+1 415 555 0198",
														},
													],
												},
												{
													type: "element",
													tagName: "span",
													attributes: {
														class: "contact-location",
													},
													children: [
														{
															type: "text",
															value: "San Francisco, CA",
														},
													],
												},
												{
													type: "element",
													tagName: "span",
													attributes: {
														class: "contact-portfolio",
													},
													children: [
														{
															type: "text",
															value: "alexchen.dev",
														},
													],
												},
											],
										},
									],
								},
								{
									type: "element",
									tagName: "section",
									attributes: {
										class: "resume-section summary-section",
									},
									children: [
										{
											type: "element",
											tagName: "h2",
											attributes: {
												class: "section-title",
											},
											children: [
												{
													type: "text",
													value: "Summary",
												},
											],
										},
										{
											type: "element",
											tagName: "p",
											attributes: {
												class: "summary-text",
											},
											children: [
												{
													type: "text",
													value: "Product-minded full-stack engineer with 6 years of experience building web applications, internal tools, and AI-assisted workflows.",
												},
											],
										},
									],
								},
								{
									type: "element",
									tagName: "section",
									attributes: {
										class: "resume-section experience-section",
									},
									children: [
										{
											type: "element",
											tagName: "h2",
											attributes: {
												class: "section-title",
											},
											children: [
												{
													type: "text",
													value: "Experience",
												},
											],
										},
										{
											type: "element",
											tagName: "div",
											attributes: {
												class: "experience-list",
											},
											children: [
												{
													type: "element",
													tagName: "article",
													attributes: {
														class: "resume-item experience-item",
													},
													children: [
														{
															type: "element",
															tagName: "h3",
															attributes: {
																class: "job-title",
															},
															children: [
																{
																	type: "text",
																	value: "Senior Software Engineer, Northstar Labs",
																},
															],
														},
														{
															type: "element",
															tagName: "p",
															attributes: {
																class: "resume-meta",
															},
															children: [
																{
																	type: "text",
																	value: "2022 - Present · San Francisco, CA",
																},
															],
														},
														{
															type: "element",
															tagName: "ul",
															attributes: {
																class: "bullet-list",
															},
															children: [
																{
																	type: "element",
																	tagName:
																		"li",
																	attributes:
																		{},
																	children: [
																		{
																			type: "text",
																			value: "Led development of a React and TypeScript analytics workspace used by operations teams.",
																		},
																	],
																},
																{
																	type: "element",
																	tagName:
																		"li",
																	attributes:
																		{},
																	children: [
																		{
																			type: "text",
																			value: "Designed API integrations that reduced manual reporting time by 40%.",
																		},
																	],
																},
																{
																	type: "element",
																	tagName:
																		"li",
																	attributes:
																		{},
																	children: [
																		{
																			type: "text",
																			value: "Partnered with product and design to ship iterative improvements every week.",
																		},
																	],
																},
															],
														},
													],
												},
												{
													type: "element",
													tagName: "article",
													attributes: {
														class: "resume-item experience-item",
													},
													children: [
														{
															type: "element",
															tagName: "h3",
															attributes: {
																class: "job-title",
															},
															children: [
																{
																	type: "text",
																	value: "Software Engineer, BrightDesk",
																},
															],
														},
														{
															type: "element",
															tagName: "p",
															attributes: {
																class: "resume-meta",
															},
															children: [
																{
																	type: "text",
																	value: "2019 - 2022 · Remote",
																},
															],
														},
														{
															type: "element",
															tagName: "ul",
															attributes: {
																class: "bullet-list",
															},
															children: [
																{
																	type: "element",
																	tagName:
																		"li",
																	attributes:
																		{},
																	children: [
																		{
																			type: "text",
																			value: "Built customer-facing dashboards with React, Node.js, and PostgreSQL.",
																		},
																	],
																},
																{
																	type: "element",
																	tagName:
																		"li",
																	attributes:
																		{},
																	children: [
																		{
																			type: "text",
																			value: "Improved page load performance and reliability across core account workflows.",
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
								{
									type: "element",
									tagName: "section",
									attributes: {
										class: "resume-section skills-section",
									},
									children: [
										{
											type: "element",
											tagName: "h2",
											attributes: {
												class: "section-title",
											},
											children: [
												{
													type: "text",
													value: "Skills",
												},
											],
										},
										{
											type: "element",
											tagName: "ul",
											attributes: {
												class: "skills-list",
											},
											children: [
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "React",
														},
													],
												},
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "TypeScript",
														},
													],
												},
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "Node.js",
														},
													],
												},
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "PostgreSQL",
														},
													],
												},
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "MobX",
														},
													],
												},
												{
													type: "element",
													tagName: "li",
													attributes: {},
													children: [
														{
															type: "text",
															value: "LLM Tooling",
														},
													],
												},
											],
										},
									],
								},
								{
									type: "element",
									tagName: "section",
									attributes: {
										class: "resume-section project-section",
									},
									children: [
										{
											type: "element",
											tagName: "h2",
											attributes: {
												class: "section-title",
											},
											children: [
												{
													type: "text",
													value: "Projects",
												},
											],
										},
										{
											type: "element",
											tagName: "div",
											attributes: {
												class: "project-list",
											},
											children: [
												{
													type: "element",
													tagName: "article",
													attributes: {
														class: "resume-item project-item",
													},
													children: [
														{
															type: "element",
															tagName: "h3",
															attributes: {},
															children: [
																{
																	type: "text",
																	value: "AI Resume Editor",
																},
															],
														},
														{
															type: "element",
															tagName: "p",
															attributes: {
																class: "project-summary",
															},
															children: [
																{
																	type: "text",
																	value: "Prototype editor that converts natural language requests into safe structured DOM patches.",
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
					],
				},
			],
		},
	},
};
