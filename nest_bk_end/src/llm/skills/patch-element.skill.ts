import { RESUME_SELECTORS } from "../../../client/src/core/resumeSelectors";

export function buildPatchElementSkill(): string {
	return `Element insertion and removal:
- Use insert_html for adding new DOM nodes inside an existing container.
- Use remove_element only for deleting a node the user explicitly asked to remove.
- For insert_html, prefer inserting into ${RESUME_SELECTORS.skillsList}, ${RESUME_SELECTORS.experienceList}, ${RESUME_SELECTORS.projectList}, or ${RESUME_SELECTORS.bulletList} when the user wants to add list items.
- For insert_html, keep HTML small and safe. Do not include script, iframe, object, embed, inline handlers, or javascript: URLs.
- For remove_element, avoid removing resume root, page root, or section containers unless the user explicitly asks to remove the whole section.
- If the user wants to replace text inside an existing node, use update_text instead of insert_html + remove_element.`;
}
