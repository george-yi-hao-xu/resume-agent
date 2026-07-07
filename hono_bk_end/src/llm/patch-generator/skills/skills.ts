import { PatchAction } from "@repo/schema";

export const SKILL_UPDATE_CSS = `
Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","from":"current text","to":"new text"}
3. {"action":"update_element_attr","selector":"CSS selector","attr":"aria-label","value":"new value"}
4. {"action":"insert_element","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
5. {"action":"remove_element","selector":"CSS selector"}
6. {"action":"clone_element","sourcePage":"1","targetPage":"2","targetLanguage":"zh-CN","textUpdates":[{"selector":".resume-title","text":"translated text"}]}
- Never invent action names. "clone_page" is invalid; use "clone_element" for page duplication.
- Prefer class selectors like ".resume-title" over bare tag selectors like "h1".
- Use a tag selector only when there is no stable class or attribute selector available.
`;

export const SKILL_UPDATE_TEXT = `
Text editing:
- Use update_text when the user wants to rewrite visible copy without changing the DOM structure.
- Prefer class selectors over bare tag selectors.
- Keep selectors narrow and target the smallest useful element.
- Set "from" to the exact current text found in the DOM. Never leave "from" empty.
- Set "to" to the new text the user asked for.
- Do not copy example values from the prompt; derive values from the DOM and user instruction.
- If the request is about adding or removing list items, use insert_html or remove_element instead.
- Preserve names, email addresses, phone numbers, URLs, company names, dates, locations, technologies, and product names unless the user explicitly asks to change them.
`;

export const SKILL_UPDATE_ATTR = `
Element attribute updates:
- Use update_element_attr when the user wants to add, change, or remove attributes without changing visible text.
- Prefer class selectors over bare tag selectors.
- Keep selectors narrow and target a single element when possible.
- Common examples include aria-label, title, data-state, data-role, alt, and lang.
- If a request is really text content change, use update_text instead.
`;

export const SKILL_INSERT_HTML = `
Element insertion and removal:
- Use insert_element for adding new DOM nodes inside an existing container.
- Use remove_element only for deleting a node the user explicitly asked to remove.
- Prefer class selectors over bare tag selectors.
- Prefer inserting into list containers when the user wants to add list items.
- For insert_element, keep HTML small and safe. Do not include script, iframe, object, embed, inline handlers, or javascript: URLs.
`;

export const SKILL_PAGE = `
Page duplication and translation:
- Use action "clone_element" for page duplication. Do not output "clone_page".
- sourcePage and targetPage are page numbers as strings, for example "1" and "2".
- Never use labels such as "default", "main", "chinese", "translated", or "zh-CN" as page ids.
- Use sourcePage "1" and targetPage "2" when the user asks for a second page or translated page.
- Put language only in targetLanguage, for example "zh-CN".
- Use textUpdates to change visible text on the cloned page, and use the actual translated text.
- Prefer class selectors over bare tag selectors inside textUpdates.
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
