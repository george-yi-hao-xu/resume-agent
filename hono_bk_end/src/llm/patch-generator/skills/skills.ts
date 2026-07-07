import { PatchAction } from "@repo/schema";

export const SKILL_UPDATE_CSS = `
Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"update_element_attr","selector":"CSS selector","attributes":{"aria-label":"value","data-state":"value"}}
4. {"action":"insert_element","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
5. {"action":"remove_element","selector":"CSS selector"}
6. {"action":"clone_element","sourcePage":"1","targetPage":"2","targetLanguage":"zh-CN","textUpdates":[{"selector":".resume-title","text":"full stack"}]}
`;

export const SKILL_UPDATE_TEXT = `
Text editing:
- Use update_text when the user wants to rewrite visible copy without changing the DOM structure.
- Keep selectors narrow and target the smallest useful element.
- If the request is about adding or removing list items, use insert_html or remove_element instead.
- Preserve names, email addresses, phone numbers, URLs, company names, dates, locations, technologies, and product names unless the user explicitly asks to change them.
`;

export const SKILL_UPDATE_ATTR = `
Element attribute updates:
- Use update_element_attr when the user wants to add, change, or remove attributes without changing visible text.
- Keep selectors narrow and target a single element when possible.
- Common examples include aria-label, title, data-state, data-role, alt, and lang.
- If a request is really text content change, use update_text instead.
`;

export const SKILL_INSERT_HTML = `
Element insertion and removal:
- Use insert_element for adding new DOM nodes inside an existing container.
- Use remove_element only for deleting a node the user explicitly asked to remove.
- Prefer inserting into list containers when the user wants to add list items.
- For insert_element, keep HTML small and safe. Do not include script, iframe, object, embed, inline handlers, or javascript: URLs.
`;

export const SKILL_PAGE = `
Page duplication and translation:
- Use clone_element for creating or replacing a whole page based on an existing page.
- Use sourcePage "1" and targetPage "2" when the user asks for a second page.
- Add targetLanguage when the user explicitly wants a translated or localized copy.
- Use textUpdates to change visible text on the cloned page.
- Keep the structure of the source page intact unless the user explicitly asks for layout changes.
`;

export const SKILLS = [
	{ name: PatchAction.UpdateCss, prompt: SKILL_UPDATE_CSS },
	{ name: PatchAction.UpdateText, prompt: SKILL_UPDATE_TEXT },
	{ name: PatchAction.UpdateElementAttr, prompt: SKILL_UPDATE_ATTR },
	{ name: PatchAction.InsertElement, prompt: SKILL_INSERT_HTML },
	{ name: PatchAction.RemoveElement, prompt: SKILL_INSERT_HTML },
	{ name: PatchAction.CloneElement, prompt: SKILL_PAGE },
];
