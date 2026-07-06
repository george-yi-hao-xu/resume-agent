export const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b";
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const OLLAMA_URL = "http://localhost:11434/api/chat";
export const OPENAI_CHAT_COMPLETIONS_URL =
	"https://api.openai.com/v1/chat/completions";

export const BLOCKED_TAGS = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED"]);

// https://apxml.com/models/qwen2-5-7b
export const MAX_TOKEN_CONTEXT = 131_000;

export const MAX_HISTORY_ENTRIES = 100;
export const MAX_RESUME_SUMMARY_CHARS = 12_000;
export const MAX_RESUME_DOM_CHARS = 60_000;
export const MAX_TEXT_PREVIEW_CHARS = 280;
export const UNSAFE_CONTEXT_SELECTORS = "script, style, iframe, object, embed";
