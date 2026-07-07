import { PatchAction, type UiPatch } from "../../client/src/types";

export type PatchParseResult = {
	patches: UiPatch[];
	invalidPatchCount: number;
};

export function parsePatchResponse(raw: string): PatchParseResult {
	const json = extractJsonArray(raw);
	let parsed;

	try{
		parsed = JSON.parse(json) as unknown;
	} catch (err: any){
		throw new Error("Failed to parse the json", err)
	}


	if (!Array.isArray(parsed)) {
		throw new Error("Model response must be a JSON array.");
	}

	const patches = parsed
		.map((patch) => normalizeUiPatch(patch))
		.filter((patch): patch is UiPatch => !!patch);
	const invalidPatchCount = parsed.length - patches.length;

	return { patches, invalidPatchCount };
}

function extractJsonArray(raw: string): string {
	const start = raw.indexOf("[");
	const end = raw.lastIndexOf("]");
	
	if (raw.indexOf("`") === 0) {
		// llm give ```json ..... ```
		const st = raw.indexOf(`n`)
		const ed = raw.lastIndexOf('`')
		const cut = raw.slice(st + 1, ed - 2)
		console.log('----- cut the ```json', cut, '-----')
		return `[${cut}]`
	}

	if (start < 0 || end < start) {
		if (raw.indexOf("{") === 0){
			// llm give a single item
			return raw
		}

		else {
			throw new Error("Not valid data type from llm: " + raw)
		}
	}

	return raw.slice(start, end + 1);
}

function normalizeUiPatch(value: unknown): UiPatch | null {
	if (!value || typeof value !== "object") {
		return null;
	}

	const patch = value as Record<string, unknown>;
	const action = normalizePatchAction(patch.action);

	if (
		action === PatchAction.UpdateCss &&
		typeof patch.selector === "string" &&
		isStringRecordLike(patch.styles)
	) {
		return {
			action,
			selector: patch.selector,
			styles: stringifyRecord(patch.styles),
		};
	}

	if (
		action === PatchAction.UpdateText &&
		typeof patch.selector === "string" &&
		patch.text !== undefined
	) {
		return {
			action,
			selector: patch.selector,
			text: String(patch.text),
		};
	}

	if (action === PatchAction.InsertHtml) {
		const parent =
			typeof patch.parent === "string"
				? patch.parent
				: typeof patch.selector === "string"
					? patch.selector
					: "";
		if (parent && typeof patch.html === "string") {
			return {
				action,
				parent,
				position:
					typeof patch.position === "string"
						? (patch.position as InsertPosition)
						: undefined,
				html: patch.html,
			};
		}
	}

	if (
		action === PatchAction.RemoveElement &&
		typeof patch.selector === "string"
	) {
		return {
			action,
			selector: patch.selector,
		};
	}

	if (
		action === PatchAction.SetSectionLayout &&
		patch.layout === "two_column"
	) {
		const left = normalizeResumeSectionArray(patch.left);
		const right = normalizeResumeSectionArray(patch.right);
		if (left && right) {
			return {
				action,
				layout: "two_column",
				left,
				right,
			};
		}
	}

	if (action === PatchAction.ClonePage) {
		const sourcePage =
			typeof patch.sourcePage === "string"
				? patch.sourcePage
				: typeof patch.source === "string"
					? patch.source
					: "1";
		const targetPage =
			typeof patch.targetPage === "string"
				? patch.targetPage
				: typeof patch.target === "string"
					? patch.target
					: "";
		const textUpdates = normalizeClonePageTextUpdates(patch.textUpdates);
		if (targetPage) {
			return {
				action,
				sourcePage,
				targetPage,
				targetLanguage:
					typeof patch.targetLanguage === "string"
						? patch.targetLanguage
						: undefined,
				textUpdates,
			};
		}
	}

	return null;
}

function normalizePatchAction(value: unknown): PatchAction | null {
	if (typeof value !== "string") {
		return null;
	}

	const normalized = value
		.trim()
		.replace(/[-\s]/g, "_")
		.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)
		.replace(/^_/, "");
	const aliases: Record<string, PatchAction> = {
		update_css: PatchAction.UpdateCss,
		update_text: PatchAction.UpdateText,
		insert_html: PatchAction.InsertHtml,
		remove_element: PatchAction.RemoveElement,
		set_section_layout: PatchAction.SetSectionLayout,
		clone_page: PatchAction.ClonePage,
	};

	return aliases[normalized] ?? null;
}

function normalizeResumeSectionArray(
	value: unknown,
): Array<"summary" | "experience" | "skills" | "projects"> | null {
	const values = Array.isArray(value)
		? value
		: typeof value === "string"
			? [value]
			: null;
	if (!values) {
		return null;
	}

	const allowedSections = new Set([
		"summary",
		"experience",
		"skills",
		"projects",
	]);
	const sections = values.filter(
		(item): item is "summary" | "experience" | "skills" | "projects" => {
			return typeof item === "string" && allowedSections.has(item);
		},
	);

	return sections.length === values.length ? sections : null;
}

function normalizeClonePageTextUpdates(
	value: unknown,
): Array<{ selector: string; text: string }> | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}

	const updates = value
		.filter(
			(item): item is Record<string, unknown> =>
				!!item && typeof item === "object",
		)
		.filter(
			(item) =>
				typeof item.selector === "string" && item.text !== undefined,
		)
		.map((item) => ({
			selector: item.selector as string,
			text: String(item.text),
		}));

	return updates.length ? updates : undefined;
}

function isStringRecordLike(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function stringifyRecord(
	value: Record<string, unknown>,
): Record<string, string> {
	return Object.fromEntries(
		Object.entries(value)
			.filter(
				([property, propertyValue]) =>
					property &&
					propertyValue !== undefined &&
					propertyValue !== null,
			)
			.map(([property, propertyValue]) => [
				property,
				String(propertyValue),
			]),
	);
}
