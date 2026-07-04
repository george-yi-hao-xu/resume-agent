import { PAGE_LAYOUT, PatchAction } from "../types";
import { ResumeStore } from "./ResumeStore";

describe("ResumeStore history", () => {
  it("builds a structured summary and sanitized resume DOM separately", () => {
    const store = new ResumeStore();
    store.setDoc(createResumeDocument());

    expect(store.resumeSummary).toContain("Page 1");
    expect(store.resumeSummary).toContain("Selector: #page-01");
    expect(store.resumeSummary).toContain('Root: article#page-01.resume[data-resume-page="1"]');
    expect(store.resumeSummary).toContain('heading="Alex Morgan"');
    expect(store.resumeSummary).toContain("Full-Stack Engineer");
    expect(store.resumeSummary).not.toContain("<main data-resume-root");

    expect(store.resumeDom).toContain("<main data-resume-root");
    expect(store.resumeDom).toContain('data-resume-page="1"');
    expect(store.resumeDom).toContain('<h1 class="resume-name">Alex Morgan</h1>');
    expect(store.resumeDom).toContain('<p class="summary-text">Builds reliable product systems.</p>');
    expect(store.resumeDom).not.toContain("<script");
    expect(store.resumeDom).not.toContain("<style");
    expect(store.structureSummary).toBe(store.resumeSummary);
  });

  it("records applied changes and can undo and redo them", () => {
    const store = new ResumeStore();
    store.setDoc(createResumeDocument());

    const results = store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);

    expect(results).toEqual([
      {
        ok: true,
        action: PatchAction.UpdateText,
        message: "Updated text on 1 element."
      }
    ]);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
    expect(store.undoCount).toBe(1);
    expect(store.history[0]).toMatchObject({
      patches: [
        {
          action: PatchAction.UpdateText,
          selector: ".resume-name",
          text: "Grace Liu"
        }
      ],
      results
    });
    expect(store.html).toContain("Grace Liu");

    expect(store.undo()).toBe(true);
    expect(store.html).toContain("Alex Morgan");
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);

    expect(store.redo()).toBe(true);
    expect(store.html).toContain("Grace Liu");
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
  });

  it("clears redo history when a new change is applied after undo", () => {
    const store = new ResumeStore();
    store.setDoc(createResumeDocument());

    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);
    store.undo();
    store.setDoc(parseHtml(store.html));

    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-title",
        text: "AI Engineer"
      }
    ]);

    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
    expect(store.redo()).toBe(false);
  });

  it("does not record history when patches do not change the document", () => {
    const store = new ResumeStore();
    store.setDoc(createResumeDocument());

    const results = store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".missing",
        text: "Grace Liu"
      }
    ]);

    expect(results).toEqual([
      {
        ok: false,
        action: PatchAction.UpdateText,
        message: "No elements found for selector: .missing"
      }
    ]);
    expect(store.canUndo).toBe(false);
    expect(store.undoCount).toBe(0);
  });

  it("clears history when loading a snapshot", () => {
    const store = new ResumeStore();
    store.setDoc(createResumeDocument());
    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);

    store.loadSnapshot({ html: "<!doctype html><html><body><main data-resume-root></main></body></html>" });

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(store.html).toContain("data-resume-root");
  });

  it("sanitizes active content when loading a snapshot", () => {
    const store = new ResumeStore();

    store.loadSnapshot({
      html: `
        <!doctype html>
        <html>
          <head><style>.resume { color: blue; }</style></head>
          <body>
            <main data-resume-root>
              <article class="resume" onclick="alert('x')">
                <h1>Alex Morgan</h1>
                <script>window.bad = true;</script>
                <a href="javascript:alert('x')">Portfolio</a>
              </article>
              <iframe src="https://example.com"></iframe>
            </main>
          </body>
        </html>
      `
    });

    expect(store.html).toContain("<style>");
    expect(store.html).toContain("Alex Morgan");
    expect(store.html).not.toContain("<script");
    expect(store.html).not.toContain("<iframe");
    expect(store.html).not.toContain("onclick");
    expect(store.html).not.toContain("javascript:");
  });

  it("does not serialize preview-only page layout styles", () => {
    const store = new ResumeStore();
    const doc = createResumeDocument();
    store.setDoc(doc);

    store.setPageLayout(PAGE_LAYOUT.HORI);

    expect(doc.querySelector("[data-preview-only=\"true\"]")).not.toBeNull();
    expect(store.getSnapshot().html).not.toContain("data-preview-only");
    expect(store.html).not.toContain("resume-preview-page-layout-style");
  });

  it("syncs preview page layout through store actions", () => {
    const store = new ResumeStore();
    const doc = createResumeDocument();
    store.setDoc(doc);

    expect(store.pageLayout).toBe("vertical");
    expect(doc.querySelector("[data-preview-only=\"true\"]")).toBeNull();

    store.setPageLayout(PAGE_LAYOUT.HORI);
    expect(store.pageLayout).toBe("horizontal");
    expect(doc.querySelector("[data-preview-only=\"true\"]")?.textContent).toContain("flex-direction: row");

    store.setPageLayout(PAGE_LAYOUT.VERT);
    expect(store.pageLayout).toBe("vertical");
    expect(doc.querySelector("[data-preview-only=\"true\"]")).toBeNull();
  });
});

function createResumeDocument(): Document {
  return parseHtml(`
    <!doctype html>
    <html>
      <body>
        <main data-resume-root>
          <article class="resume">
            <header class="resume-header">
              <h1 class="resume-name">Alex Morgan</h1>
              <p class="resume-title">Full-Stack Engineer</p>
            </header>
            <section class="summary-section">
              <h2>Summary</h2>
              <p class="summary-text">Builds reliable product systems.</p>
            </section>
            <style>.resume { color: red; }</style>
            <script>window.bad = true;</script>
          </article>
        </main>
      </body>
    </html>
  `);
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
