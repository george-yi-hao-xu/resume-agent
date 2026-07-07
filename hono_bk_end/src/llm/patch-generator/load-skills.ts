import type { RunPatchState } from "./run.js";
import { SKILLS } from "./skills/skills.js";

export function loadSkills(s: RunPatchState) {
	const instruction = `${s.request.instruction} ${
		s.request.conversationHistory?.map((m) => m.content).join(" ") ?? ""
	}`.toLowerCase();

	const matchedSkills = SKILLS.filter((skill) =>
		matches[skill.name]?.test(instruction),
	);

    if (matchedSkills.length === 0) {
        return {
            ...s,
            notes: `${s.notes} no skills added`
        } as RunPatchState
    }

	const addedPrompts = matchedSkills.map((skill) => skill.prompt);

	return {
		...s,
		skills: addedPrompts,
		prompt: `${s.prompt}\n\n${addedPrompts.join("\n\n")}`,
	};
}

const matches: Record<string, RegExp> = {
	update_css: /css|style|color|spacing|layout|grid|flex|margin|padding|size|font|width|height|accent|theme/,
	update_text: /text|copy|rewrite|wording|title|headline|summary|content|rename|change wording/,
	update_element_attr: /attr|attribute|aria|alt|title|lang|data-|role/,
	insert_element: /add|insert|remove|delete|list item|bullet|new item|extra item|append|prepend/,
	remove_element: /add|insert|remove|delete|list item|bullet|new item|extra item|append|prepend/,
	clone_page: /copy|duplicate|clone|second page|page 2|translate|translation|mirror|replicate|second version|new page|翻译|复制|复刻|第二页/,
};
