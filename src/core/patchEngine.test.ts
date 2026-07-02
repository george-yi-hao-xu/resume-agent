import { applyPatches } from "./patchEngine";
import { RESUME_SELECTORS, cls } from "./resumeSelectors";
import { PatchAction, type UiPatch } from "../types";
import { describe, it, expect } from "@jest/globals";

const resumeClass = cls(RESUME_SELECTORS.resume);
const resumeNameClass = cls(RESUME_SELECTORS.resumeName);
const summaryTextClass = cls(RESUME_SELECTORS.summaryText);
const skillsListClass = cls(RESUME_SELECTORS.skillsList);
const projectListClass = cls(RESUME_SELECTORS.projectList);

function createResumeDocument(): Document {
  const doc = document.implementation.createHTMLDocument("resume-test");
  const style = doc.createElement("style");
  style.textContent = `
    .${resumeClass} {
      --accent-color: #2563eb;
    }
    .${resumeNameClass} {
      color: var(--accent-color);
    }
  `;
  doc.head.append(style);
  doc.body.innerHTML = `
    <main data-resume-root class="${resumeClass}">
      <h1 class="${resumeNameClass}">Old Name</h1>
      <p class="${summaryTextClass}">Old summary</p>
      <ul class="${skillsListClass}">
        <li class="skill">TypeScript</li>
        <li class="skill">React</li>
      </ul>
      <section class="${projectListClass}">
        <article class="project">Legacy project</article>
      </section>
    </main>
  `;
  return doc;
}

describe("applyPatches", () => {
  it("updates text content for every matching element", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.UpdateText,
        selector: ".skill",
        text: "Frontend"
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.UpdateText,
        message: "Updated text on 2 elements."
      }
    ]);
    expect(Array.from(doc.querySelectorAll(".skill")).map((node) => node.textContent)).toEqual([
      "Frontend",
      "Frontend"
    ]);
  });

  it("updates inline CSS and converts camelCase property names", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.UpdateCss,
        selector: RESUME_SELECTORS.resumeName,
        styles: {
          backgroundColor: "rgb(1, 2, 3)",
          fontWeight: "700"
        }
      }
    ]);

    const heading = doc.querySelector<HTMLElement>(RESUME_SELECTORS.resumeName);
    expect(results[0]).toMatchObject({ ok: true, action: PatchAction.UpdateCss });
    expect(heading?.style.getPropertyValue("background-color")).toBe("rgb(1, 2, 3)");
    expect(heading?.style.getPropertyValue("font-weight")).toBe("700");
  });

  it("rejects unsupported CSS custom properties", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.UpdateCss,
        selector: RESUME_SELECTORS.resume,
        styles: {
          "--experience-skills-width": "50%"
        }
      }
    ]);

    expect(results).toEqual([
      {
        ok: false,
        action: PatchAction.UpdateCss,
        message: "Unsupported CSS custom property: --experience-skills-width"
      }
    ]);
    expect(doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume)?.style.getPropertyValue("--experience-skills-width")).toBe("");
  });

  it("allows the resume accent custom property", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.UpdateCss,
        selector: RESUME_SELECTORS.resume,
        styles: {
          "--accent-color": "green"
        }
      }
    ]);

    expect(results[0]).toMatchObject({ ok: true, action: PatchAction.UpdateCss });
    expect(doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume)?.style.getPropertyValue("--accent-color")).toBe("green");
  });

  it("inserts sanitized HTML into a valid parent", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.InsertHtml,
        parent: RESUME_SELECTORS.skillsList,
        position: "beforeend",
        html: `
          <li class="skill new-skill" onclick="alert('x')">
            Node.js
            <script>window.evil = true</script>
            <a href="javascript:alert('x')">Portfolio</a>
          </li>
          <iframe src="https://example.com"></iframe>
        `
      }
    ]);

    const inserted = doc.querySelector<HTMLElement>(".new-skill");
    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.InsertHtml,
        message: `Inserted HTML into ${RESUME_SELECTORS.skillsList}.`
      }
    ]);
    expect(inserted).not.toBeNull();
    expect(inserted?.getAttribute("onclick")).toBeNull();
    expect(inserted?.querySelector("script")).toBeNull();
    expect(inserted?.querySelector("a")?.getAttribute("href")).toBeNull();
    expect(doc.querySelector("iframe")).toBeNull();
  });

  it("removes every element matching a selector", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.RemoveElement,
        selector: ".project"
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.RemoveElement,
        message: "Removed 1 element."
      }
    ]);
    expect(doc.querySelector(".project")).toBeNull();
  });

  it("returns failed results for missing selectors without stopping later patches", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.UpdateText,
        selector: ".missing",
        text: "Ignored"
      },
      {
        action: PatchAction.UpdateText,
        selector: RESUME_SELECTORS.summaryText,
        text: "Updated summary"
      }
    ]);

    expect(results).toEqual([
      {
        ok: false,
        action: PatchAction.UpdateText,
        message: "No elements found for selector: .missing"
      },
      {
        ok: true,
        action: PatchAction.UpdateText,
        message: "Updated text on 1 element."
      }
    ]);
    expect(doc.querySelector(RESUME_SELECTORS.summaryText)?.textContent).toBe("Updated summary");
  });

  it("reports non-array payloads and unknown actions", () => {
    const doc = createResumeDocument();

    expect(applyPatches(doc, null as unknown as UiPatch[])).toEqual([
      {
        ok: false,
        action: PatchAction.Unknown,
        message: "Patch payload must be an array."
      }
    ]);

    expect(applyPatches(doc, [{ action: "unsupported" } as unknown as UiPatch])).toEqual([
      {
        ok: false,
        action: PatchAction.Unknown,
        message: "Unknown patch action ignored."
      }
    ]);
  });

  it("includes document debug details when an insert parent is missing", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.InsertHtml,
        parent: ".does-not-exist",
        html: "<li>Missing parent</li>"
      }
    ]);

    expect(results[0]).toMatchObject({
      ok: false,
      action: PatchAction.InsertHtml
    });
    expect(results[0].message).toContain("No parent found for selector: .does-not-exist.");
    expect(results[0].message).toContain("Resume loaded: true.");
    expect(results[0].message).toContain("Skills list present: true.");
  });
});
