import { PatchAction, type UiPatch } from "../types";
import { cls, RESUME_SELECTORS } from "./resumeSelectors";
import {
  getResumeVTextContent,
  parseResumeVTreeFromHtml,
  queryResumeVTree,
  serializeResumeVTree
} from "./resumeVTree";
import { applyResumeVTreePatches } from "./resumeVTreePatchEngine";

const resumeClass = cls(RESUME_SELECTORS.resume);
const resumeNameClass = cls(RESUME_SELECTORS.resumeName);
const summaryTextClass = cls(RESUME_SELECTORS.summaryText);
const skillsListClass = cls(RESUME_SELECTORS.skillsList);

describe("applyResumeVTreePatches", () => {
  it("updates text content for every matching element", () => {
    const result = applyResumeVTreePatches(createResumeTree(), [
      {
        action: PatchAction.UpdateText,
        selector: ".skill",
        text: "Frontend"
      }
    ]);

    expect(result.results).toEqual([
      {
        ok: true,
        action: PatchAction.UpdateText,
        message: "Updated text on 2 elements."
      }
    ]);
    expect(queryResumeVTree(result.tree, ".skill").map(({ node }) => getResumeVTextContent(node))).toEqual([
      "Frontend",
      "Frontend"
    ]);
  });

  it("updates inline CSS and validates custom properties", () => {
    const rejected = applyResumeVTreePatches(createResumeTree(), [
      {
        action: PatchAction.UpdateCss,
        selector: RESUME_SELECTORS.resume,
        styles: {
          "--experience-skills-width": "50%"
        }
      }
    ]);
    expect(rejected.results).toEqual([
      {
        ok: false,
        action: PatchAction.UpdateCss,
        message: "Unsupported CSS custom property: --experience-skills-width"
      }
    ]);

    const accepted = applyResumeVTreePatches(createResumeTree(), [
      {
        action: PatchAction.UpdateCss,
        selector: RESUME_SELECTORS.resume,
        styles: {
          "--accent-color": "green",
          backgroundColor: "rgb(1, 2, 3)"
        }
      }
    ]);
    const resume = queryResumeVTree(accepted.tree, RESUME_SELECTORS.resume)[0]?.node;
    expect(accepted.results[0]).toMatchObject({ ok: true, action: PatchAction.UpdateCss });
    expect(resume?.attributes.style).toContain("--accent-color: green");
    expect(resume?.attributes.style).toContain("background-color: rgb(1, 2, 3)");
  });

  it("inserts sanitized HTML into a valid parent", () => {
    const result = applyResumeVTreePatches(createResumeTree(), [
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

    const html = serializeResumeVTree(result.tree);
    expect(result.results).toEqual([
      {
        ok: true,
        action: PatchAction.InsertHtml,
        message: `Inserted HTML into ${RESUME_SELECTORS.skillsList}.`
      }
    ]);
    expect(html).toContain("new-skill");
    expect(html).toContain("Node.js");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
  });

  it("arranges resume sections with a semantic two-column layout", () => {
    const result = applyResumeVTreePatches(createResumeTree(), [
      {
        action: PatchAction.SetSectionLayout,
        layout: "two_column",
        left: ["skills"],
        right: ["experience"]
      }
    ]);

    expect(result.results).toEqual([
      {
        ok: true,
        action: PatchAction.SetSectionLayout,
        message: "Arranged sections into a two-column layout."
      }
    ]);
    expect(queryResumeVTree(result.tree, ".resume-section-layout-two-column")).toHaveLength(1);
    expect(queryResumeVTree(result.tree, ".resume-layout-left .skills-section")).toHaveLength(1);
    expect(queryResumeVTree(result.tree, ".resume-layout-right .experience-section")).toHaveLength(1);
    expect(queryResumeVTree(result.tree, "#resume-semantic-layout-styles")).toHaveLength(1);
  });

  it("clones a resume page and applies scoped text updates", () => {
    const result = applyResumeVTreePatches(createResumeTree(), [
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

    expect(result.results).toEqual([
      {
        ok: true,
        action: PatchAction.ClonePage,
        message: "Cloned resume page 1 to page 2 and applied 2 text updates."
      }
    ]);
    expect(queryResumeVTree(result.tree, "#page-02")).toHaveLength(1);
    expect(queryResumeVTree(result.tree, "#page-01 .resume-name").map(({ node }) => getResumeVTextContent(node))).toEqual(["Old Name"]);
    expect(queryResumeVTree(result.tree, "#page-02 .resume-name").map(({ node }) => getResumeVTextContent(node))).toEqual(["旧名称"]);
    expect(queryResumeVTree(result.tree, "#page-02 .summary-text").map(({ node }) => getResumeVTextContent(node))).toEqual(["中文总结"]);
  });

  it("reports non-array payloads and unknown actions", () => {
    expect(applyResumeVTreePatches(createResumeTree(), null as unknown as UiPatch[]).results).toEqual([
      {
        ok: false,
        action: PatchAction.Unknown,
        message: "Patch payload must be an array."
      }
    ]);

    expect(applyResumeVTreePatches(createResumeTree(), [{ action: "unsupported" } as unknown as UiPatch]).results).toEqual([
      {
        ok: false,
        action: PatchAction.Unknown,
        message: "Unknown patch action ignored."
      }
    ]);
  });
});

function createResumeTree() {
  return parseResumeVTreeFromHtml(`
    <!doctype html>
    <html>
      <head>
        <style>
          .${resumeClass} {
            --accent-color: #2563eb;
          }
          .${resumeNameClass} {
            color: var(--accent-color);
          }
        </style>
      </head>
      <body>
        <main data-resume-root>
          <article id="page-01" class="${resumeClass}" data-resume-page="1">
            <h1 class="${resumeNameClass}">Old Name</h1>
            <section class="resume-section ${cls(RESUME_SELECTORS.summarySection)}">
              <p class="${summaryTextClass}">Old summary</p>
            </section>
            <section class="resume-section ${cls(RESUME_SELECTORS.experienceSection)}">
              <h2>Experience</h2>
            </section>
            <section class="resume-section ${cls(RESUME_SELECTORS.skillsSection)}">
              <h2>Skills</h2>
              <ul class="${skillsListClass}">
                <li class="skill">TypeScript</li>
                <li class="skill">React</li>
              </ul>
            </section>
          </article>
        </main>
      </body>
    </html>
  `);
}
