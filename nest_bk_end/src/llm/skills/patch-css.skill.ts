import { RESUME_SELECTORS } from "../../../client/src/core/resumeSelectors";

export function buildPatchCssSkill(): string {
	return `CSS editing:
- Use update_css for color, spacing, layout, typography, size, alignment, and other style changes on existing nodes.
- Prefer narrow selectors that target a single element or a stable container.
- For accent color changes, update ${RESUME_SELECTORS.resume} with {"--accent-color":"value"}.
- Use real CSS properties such as display, grid-template-columns, width, max-width, margin, padding, gap, flex, flex-wrap, font-size, line-height, and color.
- CamelCase or kebab-case property names are both acceptable.
- Do not use update_css when the user is asking to change text content.`;
}
