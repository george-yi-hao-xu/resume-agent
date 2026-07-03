import { applyPatches } from "./patchEngine";
import { RESUME_SELECTORS, cls } from "./resumeSelectors";
import { PatchAction, type UiPatch } from "../types";
import { describe, it, expect } from "@jest/globals";

const resumeClass = cls(RESUME_SELECTORS.resume);
const resumeNameClass = cls(RESUME_SELECTORS.resumeName);
const summaryTextClass = cls(RESUME_SELECTORS.summaryText);
const experienceSectionClass = cls(RESUME_SELECTORS.experienceSection);
const skillsSectionClass = cls(RESUME_SELECTORS.skillsSection);
const skillsListClass = cls(RESUME_SELECTORS.skillsList);
const projectSectionClass = cls(RESUME_SELECTORS.projectSection);
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
      <section class="resume-section ${cls(RESUME_SELECTORS.summarySection)}">
        <p class="${summaryTextClass}">Old summary</p>
      </section>
      <section class="resume-section ${experienceSectionClass}">
        <h2>Experience</h2>
      </section>
      <section class="resume-section ${skillsSectionClass}">
        <h2>Skills</h2>
        <ul class="${skillsListClass}">
          <li class="skill">TypeScript</li>
          <li class="skill">React</li>
        </ul>
      </section>
      <section class="resume-section ${projectSectionClass}">
        <div class="${projectListClass}">
          <article class="project">Legacy project</article>
        </div>
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

  it("arranges resume sections with a semantic two-column layout", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.SetSectionLayout,
        layout: "two_column",
        left: ["skills"],
        right: ["experience"]
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.SetSectionLayout,
        message: "Arranged sections into a two-column layout."
      }
    ]);
    const layout = doc.querySelector<HTMLElement>(".resume-section-layout-two-column");
    expect(layout).not.toBeNull();
    expect(doc.getElementById("resume-semantic-layout-styles")).not.toBeNull();
    expect(layout?.querySelector(".resume-layout-left .skills-section")).not.toBeNull();
    expect(layout?.querySelector(".resume-layout-right .experience-section")).not.toBeNull();
  });

  it("clones a resume page with its full descendant DOM", () => {
    const doc = createResumeDocument();
    const source = doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume);
    source?.setAttribute("id", "page-01");
    source?.setAttribute("data-resume-page", "1");

    const results = applyPatches(doc, [
      {
        action: PatchAction.ClonePage,
        sourcePage: "1",
        targetPage: "2",
        targetLanguage: "zh-CN"
      }
    ]);

    const clonedPage = doc.querySelector<HTMLElement>("#page-02");
    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.ClonePage,
        message: "Cloned resume page 1 to page 2."
      }
    ]);
    expect(clonedPage?.dataset.resumePage).toBe("2");
    expect(clonedPage?.querySelectorAll(`.${skillsListClass} li`)).toHaveLength(2);
    expect(clonedPage?.querySelector(`.${projectListClass} .project`)?.textContent).toBe("Legacy project");
  });

  it("replaces an existing target page when cloning again", () => {
    const doc = createResumeDocument();
    const source = doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume);
    source?.setAttribute("id", "page-01");
    source?.setAttribute("data-resume-page", "1");
    doc.body.insertAdjacentHTML(
      "beforeend",
      `<main id="page-02" class="${resumeClass}" data-resume-page="2"><section class="${skillsSectionClass}"></section></main>`
    );

    const results = applyPatches(doc, [
      {
        action: PatchAction.ClonePage,
        sourcePage: "1",
        targetPage: "2"
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.ClonePage,
        message: "Replaced resume page 2 with a clone of page 1."
      }
    ]);
    expect(doc.querySelectorAll("#page-02")).toHaveLength(1);
    expect(doc.querySelectorAll("#page-02 .skill")).toHaveLength(2);
    expect(doc.querySelector("#page-02 .project")?.textContent).toBe("Legacy project");
  });

  it("applies text updates to the cloned page without changing the source page", () => {
    const doc = createResumeDocument();
    const source = doc.querySelector<HTMLElement>(RESUME_SELECTORS.resume);
    source?.setAttribute("id", "page-01");
    source?.setAttribute("data-resume-page", "1");

    const results = applyPatches(doc, [
      {
        action: PatchAction.ClonePage,
        sourcePage: "1",
        targetPage: "2",
        targetLanguage: "zh-CN",
        textUpdates: [
          {
            selector: ".resume-name",
            text: "旧名称"
          },
          {
            selector: "#page-02 .summary-text",
            text: "中文总结"
          }
        ]
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.ClonePage,
        message: "Cloned resume page 1 to page 2 and applied 2 text updates."
      }
    ]);
    expect(doc.querySelector("#page-01 .resume-name")?.textContent).toBe("Old Name");
    expect(doc.querySelector("#page-02 .resume-name")?.textContent).toBe("旧名称");
    expect(doc.querySelector("#page-01 .summary-text")?.textContent).toBe("Old summary");
    expect(doc.querySelector("#page-02 .summary-text")?.textContent).toBe("中文总结");
    expect(doc.querySelectorAll("#page-02 .skill")).toHaveLength(2);
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
