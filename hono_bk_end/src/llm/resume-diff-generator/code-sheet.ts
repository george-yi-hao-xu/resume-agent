import type {
	ResumeDiffRequest,
	Resume,
} from "@repo/schema";

export function readResumeFromRequest(request: ResumeDiffRequest): Resume | null {
	const source = request.resumeDom ?? request.resumeStructure ?? "";
	if (!source.trim()) {
		return null;
	}

	try {
		const parsed = JSON.parse(source) as Resume;
		if (
			parsed &&
			typeof parsed === "object" &&
			Array.isArray(parsed.styles) &&
			parsed.tree?.root
		) {
			return parsed;
		}
	} catch {
		return null;
	}

	return null;
}

export function buildResumeJsonFile(resume: Resume | null): string {
	if (!resume) {
		return "No parseable resume JSON was provided.";
	}

	return JSON.stringify(resume, null, 2);
}
