import { RESUME_SELECTORS } from "../../../client/src/core/resumeSelectors";

export function buildPatchContextSkill(
	allowedCssCustomProperties: string[],
	resumeSummary: string,
	resumeDom: string,
): string {
	const allowedTokenList = allowedCssCustomProperties.length
		? allowedCssCustomProperties
				.map((property) => `- ${property}`)
				.join("\n")
		: "- None";
	const summaryDetails =
		resumeSummary.trim() || "No structured resume summary is available.";
	const domDetails = resumeDom.trim();
	const fullDomSection = domDetails
		? `\nCurrent resume full DOM:\n${domDetails}\n`
		: "";

	return `The preview is a resume. Available page selectors:
${Object.values(RESUME_SELECTORS)
	.map((selector) => `- ${selector}`)
	.join("\n")}

Current resume structured summary:
${summaryDetails}
${fullDomSection}

Do not invent CSS custom properties. Only use CSS custom properties listed below:
${allowedTokenList}`;
}
