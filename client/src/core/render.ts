// render.ts
// convert the resume js object into an iframe src doc string
import { v_style_node, type Resume } from "@repo/schema/src/resume.types";
import { PAGE_LAYOUT } from "../types";

export function render(r: Resume): string {
	return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
${indent(`${renderStyleSheet(r)}${insertStyles()}`, 6)}
    </style>
  </head>
${indent(renderBodyEle(r), 2)}
</html>
  `.trim();
}

function renderStyleSheet(r: Resume) {
	let result = "";

	for (const s of r.styles) {
		if (s.hasOwnProperty("selector") && s.hasOwnProperty("attributes")) {
			const s_assert = s as v_style_node;
			result += `${s_assert.selector} {\n`;
			for (const attrKey of Object.keys(s_assert.attributes)) {
				const attrVal = s_assert.attributes[attrKey];
				result += `  ${attrKey}: ${attrVal};\n`;
			}
			result += `}\n\n`;
		} else if (s.hasOwnProperty("media") && s.hasOwnProperty("rules")) {
			const mediaItem = s as { media: string; rules: v_style_node[] };
			result += `@media ${mediaItem.media} {\n`;
			for (const rule of mediaItem.rules) {
				result += `  ${rule.selector} {\n`;
				for (const attrKey of Object.keys(rule.attributes)) {
					const attrVal = rule.attributes[attrKey];
					result += `    ${attrKey}: ${attrVal};\n`;
				}
				result += `  }\n\n`;
			}
			result += `}\n\n`;
		} else if (s.hasOwnProperty("atRule") && s.hasOwnProperty("attributes")) {
			const atRuleItem = s as {
				atRule: string;
				attributes: Record<string, string>;
			};
			result += `${atRuleItem.atRule} {\n`;
			for (const attrKey of Object.keys(atRuleItem.attributes)) {
				const attrVal = atRuleItem.attributes[attrKey];
				result += `  ${attrKey}: ${attrVal};\n`;
			}
			result += `}\n\n`;
		} else {
			throw new Error("invalid style item");
		}
	}

	return result;
}

function insertStyles() {
	return `/* page layout style DO NOT MOVE */
.${PAGE_LAYOUT.VERT} { display: flex; flex-direction: column; }
.${PAGE_LAYOUT.HORI} { display: flex; flex-direction: row; }
`;
}

function renderBodyEle(r: Resume) {
	return serializeNode(r.tree.root);
}

function serializeNode(node: Resume["tree"]["root"], lv = 0): string {
	const _padding = "  ".repeat(lv);

	if (node.type === "text") {
		return `${_padding}${esc(node.value ?? "")}`;
	}

	const attributesStr = serializeAttributes(node.attributes, node.wd, isTextLeaf(node));
	const children = node.children ?? [];

	const tag_attr = attributesStr ? ` ${attributesStr}` : "";
	const openTag = `${_padding}<${node.tagName}${tag_attr}>`;

	if (isVoidElement(node.tagName)) {
		return `${_padding}<${node.tagName} ${tag_attr} />`;
	}

	if (children.length === 1 && children[0].type === "text") {
		return `${openTag}${esc(children[0].value ?? "")}</${node.tagName}>`;
	}

	if (children.length === 0) {
		return `${openTag}</${node.tagName}>`;
	}

	return `${openTag}
${children.map((child) => serializeNode(child, lv + 1)).join("\n")}
${_padding}</${node.tagName}>`;
}

// check if it's the end LEAF, instead of a CONTAINER
// see if it has a child, and one text child only
function isTextLeaf(node: Resume["tree"]["root"]): boolean {
	const children = node.children;
	if (!children) return false;
	return children.length === 1 && children[0].type === "text";
}

function serializeAttributes(
	attributes: Record<string, string> | undefined,
	wd: string,
	isTextLeaf: boolean,
): string {
	const merged: Record<string, string> = { ...(attributes ?? {}) };

	// use wd as ID and set to dom element
	if (!("data-wd" in merged)) {
		merged["data-wd"] = wd;
	}

	if (isTextLeaf) {
		merged["data-text-leaf"] = "";
	}

	// insert attr into dom element
	let serialized = "";
	for (const [name, value] of Object.entries(merged)) {
		if (value === "") {
			serialized += ` ${name}`;
		} else {
			serialized += ` ${name}="${escAttr(value)}"`;
		}
	}

	return serialized.trim();
}

function esc(value: string): string {
	return value .split("&") .join("&amp;") .split("<") .join("&lt;")
		.split(">") .join("&gt;");
}

function escAttr(value: string): string {
	return esc(value).split('"').join("&quot;");
}

function indent(text: string, spaces: number): string {
	const _padding = " ".repeat(spaces);

	return text .split("\n")
		.map((line) => (line.length > 0 ? `${_padding}${line}` : line))
		.join("\n");
}

function isVoidElement(tagName: string | undefined): boolean {
	return [ "meta", "link", "img", "br", "hr", "input", "source", "track", "area",
		"base", "col", "embed", "param", "wbr", ].includes(tagName ?? "");
}
