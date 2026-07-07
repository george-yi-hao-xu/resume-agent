export function buildPatchPageSkill(): string {
	return `Page duplication and translation:
- Use clone_page for creating or replacing a whole page based on an existing page.
- Use sourcePage "1" and targetPage "2" when the user asks for a second page.
- Add targetLanguage when the user explicitly wants a translated or localized copy.
- Use textUpdates to change visible text on the cloned page.
- Keep the structure of the source page intact unless the user explicitly asks for layout changes.
- If the user wants a copied or mirrored page, clone_page is preferred over insert_html.`;
}
