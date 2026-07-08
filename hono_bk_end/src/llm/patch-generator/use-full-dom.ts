import type { RunPatchState } from "./run.js";
import { CHAT_ROLE } from "@repo/schema";

const FULL_DOM_THRESHOLD = 800;
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

// Decide whether to use the full DOM or a shorter summary for the next step.
export function useFullDom(state: RunPatchState): RunPatchState {
	const domLen = state.request.resumeDom?.length ?? 0;
	if (domLen <= FULL_DOM_THRESHOLD) {
		return {
			...state,
			useFullDom: true,
		};
	}

	const recentConversationText = (state.request.conversationHistory ?? [])
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
	const text = `${state.request.instruction}\n${recentConversationText}`;
	const hasIntent = FULL_DOM_INTENT_PATTERNS.some((pattern) =>
		pattern.test(text),
	);

    if (hasIntent) {
        return {
            ...state,
            useFullDom: true
        }
    }

	return { ...state};
}
