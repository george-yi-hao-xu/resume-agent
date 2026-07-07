import type { RunPatchState } from "./run.js";
import { CHAT_ROLE } from "@repo/schema";

export function loadChatHistory(s: RunPatchState) {
    const history = (s.request.conversationHistory ?? [])
        .filter((m) => m.role === CHAT_ROLE.USER || m.role === CHAT_ROLE.ASSISTANT)
        .slice(-6)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}${m.patches ? `\n${JSON.stringify(m.patches)}` : ""}`)
        .join("\n\n");

    if (!history) {
        return {...s}
    }

    return { 
        ...s, 
        prompt: `${s.prompt}\n\nRecent chat history:\n${history}` 
    }
}
