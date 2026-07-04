const CUSTOM_PROPERTY_PATTERN = /(--[A-Za-z0-9_-]+)\s*:/g;
const VAR_USAGE_PATTERN = /var\(\s*(--[A-Za-z0-9_-]+)/g;

export function getAllowedCssCustomProperties(doc: Document): string[] {
  const definedProperties = new Set<string>();
  const usedProperties = new Set<string>();

  collectStyleElementProperties(doc, definedProperties, usedProperties);
  collectStylesheetProperties(doc, definedProperties, usedProperties);
  collectInlineProperties(doc, definedProperties, usedProperties);

  return Array.from(definedProperties)
    .filter((property) => usedProperties.has(property))
    .sort();
}

function collectStyleElementProperties(doc: Document, definedProperties: Set<string>, usedProperties: Set<string>): void {
  doc.querySelectorAll("style").forEach((styleElement) => {
    collectFromCssText(styleElement.textContent ?? "", definedProperties, usedProperties);
  });
}

function collectStylesheetProperties(doc: Document, definedProperties: Set<string>, usedProperties: Set<string>): void {
  Array.from(doc.styleSheets).forEach((stylesheet) => {
    try {
      Array.from(stylesheet.cssRules).forEach((rule) => {
        collectFromCssText(rule.cssText, definedProperties, usedProperties);
      });
    } catch {
      // Cross-origin stylesheets can block cssRules access. The resume iframe uses inline CSS,
      // but ignoring inaccessible sheets keeps this helper safe for future templates.
    }
  });
}

function collectInlineProperties(doc: Document, definedProperties: Set<string>, usedProperties: Set<string>): void {
  doc.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    collectFromCssText(element.getAttribute("style") ?? "", definedProperties, usedProperties);
  });
}

function collectFromCssText(cssText: string, definedProperties: Set<string>, usedProperties: Set<string>): void {
  collectMatches(cssText, CUSTOM_PROPERTY_PATTERN, definedProperties);
  collectMatches(cssText, VAR_USAGE_PATTERN, usedProperties);
}

function collectMatches(cssText: string, pattern: RegExp, target: Set<string>): void {
  pattern.lastIndex = 0;

  let match = pattern.exec(cssText);
  while (match) {
    target.add(match[1]);
    match = pattern.exec(cssText);
  }
}
