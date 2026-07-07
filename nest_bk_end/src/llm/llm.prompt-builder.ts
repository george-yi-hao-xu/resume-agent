import { CHAT_ROLE, type ChatMessage } from "../../client/src/types";
import type { ModelMessage } from "./llm.types";
import { buildPatchActionsSkill } from "./skills/patch-actions.skill";
import { buildPatchCssSkill } from "./skills/patch-css.skill";
import { buildPatchContextSkill } from "./skills/patch-context.skill";
import { buildPatchIntroSkill } from "./skills/patch-intro.skill";
import { buildPatchElementSkill } from "./skills/patch-element.skill";
import { buildPatchTextSkill } from "./skills/patch-text.skill";
import { buildPatchRulesSkill } from "./skills/patch-rules.skill";
import { buildPatchPageSkill } from "./skills/patch-page.skill";

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
	return [
		buildPatchIntroSkill(),
		buildPatchActionsSkill(),
		buildPatchCssSkill(),
		buildPatchTextSkill(),
		buildPatchElementSkill(),
		buildPatchPageSkill(),
		buildPatchContextSkill(
			allowedCssCustomProperties,
			resumeSummary,
			resumeDom,
		),
		buildPatchRulesSkill(),
	].join("\n\n");
}
