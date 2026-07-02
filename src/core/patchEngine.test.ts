import { applyPatches } from "./patchEngine";
import { PatchAction, type UiPatch } from "../types";
import { describe, it, expect } from "@jest/globals";


function createResumeDocument(): Document {
  const doc = document.implementation.createHTMLDocument("resume-test");
  doc.body.innerHTML = `
    <main data-resume-root class="resume">
      <h1 class="resume-name">Old Name</h1>
      <p class="summary-text">Old summary</p>
      <ul class="skills-list">
        <li class="skill">TypeScript</li>
        <li class="skill">React</li>
      </ul>
      <section class="project-list">
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
        selector: ".resume-name",
        styles: {
          backgroundColor: "rgb(1, 2, 3)",
          fontWeight: "700"
        }
      }
    ]);

    const heading = doc.querySelector<HTMLElement>(".resume-name");
    expect(results[0]).toMatchObject({ ok: true, action: PatchAction.UpdateCss });
    expect(heading?.style.getPropertyValue("background-color")).toBe("rgb(1, 2, 3)");
    expect(heading?.style.getPropertyValue("font-weight")).toBe("700");
  });

  it("inserts sanitized HTML into a valid parent", () => {
    const doc = createResumeDocument();

    const results = applyPatches(doc, [
      {
        action: PatchAction.InsertHtml,
        parent: ".skills-list",
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
        message: "Inserted HTML into .skills-list."
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
        selector: ".summary-text",
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
    expect(doc.querySelector(".summary-text")?.textContent).toBe("Updated summary");
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
