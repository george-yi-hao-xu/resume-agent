import { RESUME_SELECTORS, cls } from "../../../client/src/core/resumeSelectors";

export function buildPatchRulesSkill(): string {
	return `Rules:
- Do not return a full HTML document.
- If the current resume full DOM is provided, use it for exact selectors, visible text, page duplication, and translation.
- Use the conversation history when the user refers to a previous request, correction, failed attempt, or says something like "not right", "did not work", or "没有实现".
- Prefer small, targeted patches.
- For requests that arrange resume sections beside each other, move a section left/right of another section, or create columns, prefer set_section_layout over update_css.
- Valid section ids for set_section_layout are summary, experience, skills, and projects.
- Use ${RESUME_SELECTORS.summaryText} only for the top resume summary paragraph. Use ${RESUME_SELECTORS.projectSummary} for project descriptions.
- Use only selectors that exist in the resume preview unless inserting into ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList}.
- For changing the resume accent color, update ${RESUME_SELECTORS.resume} with {"--accent-color":"color"}.
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
