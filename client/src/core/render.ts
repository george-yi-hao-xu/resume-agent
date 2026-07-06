// render.ts
// convert the resume js object into an iframe src doc string
import { v_style_node, type Resume } from "../resume.types";
import { PAGE_LAYOUT } from "../types";

export function render(r: Resume): string {
	const result = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
${renderStyleSheet(r)}
${insertStyles()}
    </style>
${renderTree(r)}
</html>
    `;

	return result;
}

function renderStyleSheet(r: Resume) {
	let result = ``;
	const styleItemList = r.styles;

	for (const s of styleItemList) {
		let curr = ``;
		// v_style_node, with selector and attributes
		if (s.hasOwnProperty("selector") && s.hasOwnProperty("attributes")) {
			const s_assert = s as v_style_node;
			// class name
			curr = `.${s_assert.selector}\{\n`;
			for (const attrKey of Object.keys(s_assert.attributes)) {
				// each style attr
				const attrVal = s_assert.attributes[attrKey];
				const line = `  ${attrKey}: ${attrVal};`;
				curr += line;
			}
			curr += `\}\n\n`;
		}
		// media setting
		else if (s.hasOwnProperty("media") && s.hasOwnProperty("rules")) {
			const mediaItem = s as { media: string; rules: v_style_node[] };
			curr = `@media ${mediaItem.media} {\n`;
			for (const rule of mediaItem.rules) {
				curr += `  .${rule.selector} {\n`;
				for (const attrKey of Object.keys(rule.attributes)) {
					const attrVal = rule.attributes[attrKey];
					curr += `    ${attrKey}: ${attrVal};\n`;
				}
				curr += `  }\n\n`;
			}
			curr += `}\n\n`;
		}
		// at rule setting
		else if (s.hasOwnProperty("atRule") && s.hasOwnProperty("attributes")) {
			const atRuleItem = s as {
				atRule: string;
				attributes: Record<string, string>;
			};
			curr = `${atRuleItem.atRule} {\n`;
			for (const attrKey of Object.keys(atRuleItem.attributes)) {
				const attrVal = atRuleItem.attributes[attrKey];
				curr += `  ${attrKey}: ${attrVal};\n`;
			}
			curr += `}\n\n`;
		} else {
			throw new Error("invalid style item");
		}

		result += curr;
	}

	return result;
}

function insertStyles() {
	return ` // page layout style DO NOT MOVE
.${PAGE_LAYOUT.VERT} { display: flex; flex-direction: column; }
.${PAGE_LAYOUT.HORI} { display: flex; flex-direction: row; }`;
}

function renderTree(r: Resume) {
	return `<!doctype html>
${serializeNode(r.tree.root)}
`;
}

function serializeNode(node: Resume["tree"]["root"]): string {
	if (node.type === "text") {
		return esc(node.value ?? "");
	}

	const attributes = serializeAttributes(node.attributes);
	const children = (node.children ?? [])
		.map((c) => serializeNode(c))
		.join("");
	const openTag = `<${node.tagName}${attributes}>`;

	if (isVoidElement(node.tagName)) {
		return openTag;
	}

	return `${openTag}
    ${children}
</${node.tagName}>`;
}

function serializeAttributes(attributes?: Record<string, string>): string {
	if (!attributes) {
		return "";
	}

	let serialized = "";
	for (const [name, value] of Object.entries(attributes)) {
		if (value === "") {
			serialized += ` ${name}`;
		} else {
			serialized += ` ${name}="${escAttr(value)}"`;
		}
	}

	return serialized;
}

function esc(value: string): string {
	return value
		.split("&")
		.join("&amp;")
		.split("<")
		.join("&lt;")
		.split(">")
		.join("&gt;");
}

function escAttr(value: string): string {
	return esc(value).split('"').join("&quot;");
}

function isVoidElement(tagName: string | undefined): boolean {
	return (
		tagName === "meta" ||
		tagName === "link" ||
		tagName === "img" ||
		tagName === "br" ||
		tagName === "hr" ||
		tagName === "input" ||
		tagName === "source" ||
		tagName === "track" ||
		tagName === "area" ||
		tagName === "base" ||
		tagName === "col" ||
		tagName === "embed" ||
		tagName === "param" ||
		tagName === "wbr"
	);
}
