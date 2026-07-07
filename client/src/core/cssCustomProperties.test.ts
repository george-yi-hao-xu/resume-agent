import { getAllowedCssCustomProperties } from "./cssCustomProperties";

describe("getAllowedCssCustomProperties", () => {
	it("returns custom properties that are both defined and consumed", () => {
		const doc = document.implementation.createHTMLDocument("tokens-test");
		const style = doc.createElement("style");
		style.textContent = `
      .resume {
        --accent-color: #2563eb;
        --unused-token: 50%;
      }
      .resume-title {
        color: var(--accent-color);
      }
      .resume-section {
        width: var(--missing-token);
      }
    `;
		doc.head.append(style);

		expect(getAllowedCssCustomProperties(doc)).toEqual(["--accent-color"]);
	});
});
