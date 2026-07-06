import { RESUME_SELECTORS, cls } from "../../client/src/core/resumeSelectors";
import { CHAT_ROLE, type ChatMessage } from "../../client/src/types";
import type { ModelMessage } from "./llm.types";

const FULL_DOM_INTENT_PATTERNS = [
	/add\s+(a\s+)?(second|new|another)\s+page/i,
	/page\s*2/i,
	/second\s+page/i,
	/chinese\s+version/i,
	/translate/i,
	/translation/i,
	/mirror/i,
	/duplicate/i,
	/copy/i,
	/replicate/i,
	/same\s+(dom\s+)?structure/i,
	/selector\s+(failed|missing|not\s+found)/i,
	/no elements found/i,
	/新增.*页/,
	/第.*页/,
	/文/,
	/英文/,
	/中文/,
	/翻译/,
	/复刻/,
	/复制/,
	/一样/,
	/相同/,
	/结构/,
	/页中页/,
	/没找到/,
	/没有找到/,
];

export function shouldIncludeFullDom(
	instruction: string,
	conversationHistory: ChatMessage[],
): boolean {
	const recentConversationText = conversationHistory
		.filter(
			(message) =>
				message.role === CHAT_ROLE.USER ||
				message.role === CHAT_ROLE.ASSISTANT,
		)
		.slice(-4)
		.map((message) => {
			const patches = message.patches
				? ` ${JSON.stringify(message.patches)}`
				: "";
			return `${message.content}${patches}`;
		})
		.join("\n");
	const text = `${instruction}\n${recentConversationText}`;

	return FULL_DOM_INTENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function buildPatchModelMessages(
	instruction: string,
	allowedCssCustomProperties: string[],
	conversationHistory: ChatMessage[],
	resumeSummary: string,
	resumeDom: string,
): ModelMessage[] {
	return [
		{
			role: CHAT_ROLE.SYSTEM,
			content: buildPatchSystemPrompt(
				allowedCssCustomProperties,
				resumeSummary,
				resumeDom,
			),
		},
		...buildConversationMessages(conversationHistory),
		{
			role: CHAT_ROLE.USER,
			content: instruction,
		},
	];
}

function buildConversationMessages(
	messages: ChatMessage[],
): Array<{ role: CHAT_ROLE.USER | CHAT_ROLE.ASSISTANT; content: string }> {
	return messages
		.filter(
			(message) =>
				message.role === CHAT_ROLE.USER ||
				message.role === CHAT_ROLE.ASSISTANT,
		)
		.slice(-8)
		.map((message) => {
			if (message.role === CHAT_ROLE.ASSISTANT && message.patches) {
				return {
					role: CHAT_ROLE.ASSISTANT,
					content: `${message.content}\nPatches returned:\n${JSON.stringify(message.patches)}`,
				};
			}

			return {
				role: message.role as CHAT_ROLE.USER | CHAT_ROLE.ASSISTANT,
				content: message.content,
			};
		});
}

function buildPatchSystemPrompt(
	allowedCssCustomProperties: string[],
	resumeSummary: string,
	resumeDom: string,
): string {
	const allowedTokenList = allowedCssCustomProperties.length
		? allowedCssCustomProperties
				.map((property) => `- ${property}`)
				.join("\n")
		: "- None";
	const summaryDetails =
		resumeSummary.trim() || "No structured resume summary is available.";
	const domDetails = resumeDom.trim();
	const fullDomSection = domDetails
		? `\nCurrent resume full DOM:\n${domDetails}\n`
		: "";

	return `You convert a user's natural language page-editing instruction into JSON UI patches.
The resume is tracked as a plain js object.
this is the type of it

\`\`\`typescript
export type v_style_node = {
	selector: string;
	attributes: Record<string, string>;
};

export type v_style_item =
	| v_style_node
	| {
			media: string;
			rules: v_style_node[];
	  }
	| {
			atRule: string;
			attributes: Record<string, string>;
	  };

export type v_dom_node = {
	type: string;
	tagName?: string;
	attributes?: {
		"data-resume-root"?: "";
		name?: string;
		id?: string;
		content?: string;
		class?: string;
		charset?: string;
		lang?: string;
	};
	value?: string;
	children?: v_dom_node[];
};

export type Resume = {
	styles: v_style_item[];
	tree: {
		doctype: "html";
		root: v_dom_node;
	};
};
\`\`\`


Return ONLY a valid JSON array, which can contain several patches. In case only one patch, still wrap it as an array. No markdown. No commentary.
For example: [{"action":"update_css","selector":".test","styles":{"cssProperty":"test"}]

Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
4. {"action":"remove_element","selector":"CSS selector"}
5. {"action":"set_section_layout","layout":"two_column","left":["skills"],"right":["experience"]}
6. {"action":"clone_page","sourcePage":"1","targetPage":"2","targetLanguage":"zh-CN","textUpdates":[{"selector":".resume-title","text":"全栈工程师"}]}

The preview is a resume. Available page selectors:
${Object.values(RESUME_SELECTORS)
	.map((selector) => `- ${selector}`)
	.join("\n")}

Current resume structured summary:
${summaryDetails}
${fullDomSection}

Rules:
- Do not return a full HTML document.
- If the current resume full DOM is provided, use it for exact selectors, visible text, page duplication, and translation.
- Use the conversation history when the user refers to a previous request, correction, failed attempt, or says something like "not right", "did not work", or "没有实现".
- Prefer small, targeted patches.
- For requests that arrange resume sections beside each other, move a section left/right of another section, or create columns, prefer set_section_layout over update_css.
- Valid section ids for set_section_layout are summary, experience, skills, and projects.
- Use ${RESUME_SELECTORS.summaryText} only for the top resume summary paragraph. Use ${RESUME_SELECTORS.projectSummary} for project descriptions.
- Use only selectors that exist in the resume preview unless inserting into ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList}.
- For adding a skill, always use {"action":"insert_html","parent":"${RESUME_SELECTORS.skillsList}","position":"beforeend","html":"<li>Skill name</li>"}.
- For adding experience, insert an <article class="resume-item ${cls(RESUME_SELECTORS.experienceItem)}"> into ${RESUME_SELECTORS.experienceList}.
- For adding a project, insert an <article class="resume-item ${cls(RESUME_SELECTORS.projectItem)}"> into ${RESUME_SELECTORS.projectList}.
- For changing the resume accent color, update ${RESUME_SELECTORS.resume} with {"--accent-color":"color"}.
- Do not invent CSS custom properties. Only use CSS custom properties listed below:
${allowedTokenList}
- For layout changes, use real CSS properties such as display, grid-template-columns, width, max-width, margin, padding, gap, flex, or flex-wrap on existing selectors.
- For CSS properties, camelCase or kebab-case are both acceptable.
- For insert_html, do not include script, iframe, object, embed, inline event handlers, or javascript: URLs.
- For requests that copy, duplicate, mirror, translate, version, or add a second-language version of an existing page, prefer clone_page over insert_html.
- Use clone_page when the user asks for a second page based on page 1. Use sourcePage "1", targetPage "2", and set targetLanguage when a language is requested. clone_page may also refresh an existing target page.
- clone_page preserves structure and source text. If the user requests another language, include textUpdates inside clone_page. Use selectors relative to the cloned target page when possible, such as ".summary-text" or ".skills-list li:nth-child(1)"; target-scoped selectors like "#page-02 .summary-text" are also accepted.
- For inserting a new page, use insert_html with parent "${RESUME_SELECTORS.root}" and position "beforeend"; never insert a page inside an existing ${RESUME_SELECTORS.resume}.
- The inserted page must be a main element with id in format page-xx, class "${cls(RESUME_SELECTORS.resume)}", and data-resume-page matching the page number.
- When the user asks for a translated, mirrored, copied, duplicated, or versioned page, copy the source page DOM tree deeply: keep every descendant element, class name, list item, resume item, bullet item, and project item, then translate or edit only visible text.
- Never replace a non-empty source container with an empty target container. If the source ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList} contains children, the inserted page must contain corresponding translated children with the same structure.
- For translated pages, keep names, emails, phone numbers, URLs, company names, dates, locations, technologies, and product names unless the user explicitly asks to change them.`;
}
