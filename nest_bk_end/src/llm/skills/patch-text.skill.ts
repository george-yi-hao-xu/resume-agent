import { RESUME_SELECTORS } from "../../../client/src/core/resumeSelectors";

export function buildPatchTextSkill(): string {
	return `Text editing:
- Use update_text when the user wants to rewrite visible copy without changing the DOM structure.
- Keep selectors narrow and target the smallest useful element.
- Use ${RESUME_SELECTORS.summaryText} only for the top resume summary paragraph.
- Use ${RESUME_SELECTORS.projectSummary} for project descriptions.
- If the request is about adding or removing list items, use insert_html or remove_element instead of update_text.
- Preserve names, email addresses, phone numbers, URLs, company names, dates, locations, technologies, and product names unless the user explicitly asks to change them.`;
}
