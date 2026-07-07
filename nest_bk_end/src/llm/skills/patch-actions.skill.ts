export function buildPatchActionsSkill(): string {
	return `Allowed actions:
1. {"action":"update_css","selector":"CSS selector","styles":{"cssProperty":"value"}}
2. {"action":"update_text","selector":"CSS selector","text":"new text"}
3. {"action":"insert_html","parent":"CSS selector","position":"beforeend","html":"safe HTML string"}
4. {"action":"remove_element","selector":"CSS selector"}
5. {"action":"set_section_layout","layout":"two_column","left":["skills"],"right":["experience"]}
6. {"action":"clone_page","sourcePage":"1","targetPage":"2","targetLanguage":"zh-CN","textUpdates":[{"selector":".resume-title","text":"全栈工程师"}]}`;
}
