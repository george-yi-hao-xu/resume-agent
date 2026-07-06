import {
  buildResumeSummary,
  serializeResumeContextHtml
} from "../core/resumeVTreeDerived";
import {
  parseResumeVTreeFromHtml,
  renderResumePreviewSrcDoc,
  serializeResumeVTree
} from "../core/resumeVTree";
import { PAGE_LAYOUT, PatchAction } from "../types";
import { ResumeStore, type ResumeSnapshot } from "./ResumeStore";

describe("ResumeStore tree history", () => {
  it("keeps derived summary and sanitized context outside the store", () => {
    const store = createStoreFromHtml(createResumeHtml());

    const summary = buildResumeSummary(store.tree);
    const contextHtml = serializeResumeContextHtml(store.tree);

    expect(summary).toContain("Page 1");
    expect(summary).toContain("Selector: #page-01");
    expect(summary).toContain('Root: article#page-01.resume[data-resume-page="1"]');
    expect(summary).toContain('heading="Alex Morgan"');
    expect(summary).toContain("Full-Stack Engineer");
    expect(summary).not.toContain("<main data-resume-root");

    expect(contextHtml).toContain("<main data-resume-root");
    expect(contextHtml).toContain('data-resume-page="1"');
    expect(contextHtml).toContain('<h1 class="resume-name">Alex Morgan</h1>');
    expect(contextHtml).toContain('<p class="summary-text">Builds reliable product systems.</p>');
    expect(contextHtml).not.toContain("<script");
    expect(contextHtml).not.toContain("<style");
  });

  it("records applied changes and can undo and redo them", () => {
    const store = createStoreFromHtml(createResumeHtml());

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
    expect(serializeResumeVTree(store.tree)).toContain("Grace Liu");

    expect(store.undo()).toBe(true);
    expect(serializeResumeVTree(store.tree)).toContain("Alex Morgan");
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(true);

    expect(store.redo()).toBe(true);
    expect(serializeResumeVTree(store.tree)).toContain("Grace Liu");
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
  });

  it("clears redo history when a new change is applied after undo", () => {
    const store = createStoreFromHtml(createResumeHtml());

    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);
    store.undo();

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

  it("does not record history when patches do not change the tree", () => {
    const store = createStoreFromHtml(createResumeHtml());

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
    const store = createStoreFromHtml(createResumeHtml());
    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);

    store.loadSnapshot(createSnapshot("<!doctype html><html><body><main data-resume-root></main></body></html>"));

    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
    expect(serializeResumeVTree(store.tree)).toContain("data-resume-root");
  });

  it("sanitizes active content when loading a snapshot", () => {
    const store = new ResumeStore();

    store.loadSnapshot(createSnapshot(`
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
    `));

    const html = serializeResumeVTree(store.tree);
    expect(html).toContain("<style>");
    expect(html).toContain("Alex Morgan");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
  });

  it("renders preview-only page layout styles without saving them", () => {
    const store = createStoreFromHtml(createResumeHtml());

    store.setPageLayout(PAGE_LAYOUT.HORI);

    expect(renderResumePreviewSrcDoc(store.tree, { pageLayout: store.pageLayout })).toContain("data-preview-only");
    expect(renderResumePreviewSrcDoc(store.tree, { pageLayout: store.pageLayout })).toContain("resume-preview-page-layout-style");
    expect(serializeResumeVTree(store.getSnapshot().tree)).not.toContain("data-preview-only");
    expect(serializeResumeVTree(store.getSnapshot().tree)).not.toContain("resume-preview-page-layout-style");
  });

  it("syncs preview page layout through derived preview HTML", () => {
    const store = createStoreFromHtml(createResumeHtml());

    expect(store.pageLayout).toBe("vertical");
    expect(renderResumePreviewSrcDoc(store.tree, { pageLayout: store.pageLayout })).not.toContain("data-preview-only");

    store.setPageLayout(PAGE_LAYOUT.HORI);
    expect(store.pageLayout).toBe("horizontal");
    expect(renderResumePreviewSrcDoc(store.tree, { pageLayout: store.pageLayout })).toContain("flex-direction: row");

    store.setPageLayout(PAGE_LAYOUT.VERT);
    expect(store.pageLayout).toBe("vertical");
    expect(renderResumePreviewSrcDoc(store.tree, { pageLayout: store.pageLayout })).not.toContain("data-preview-only");
  });
});

function createStoreFromHtml(html: string): ResumeStore {
  const store = new ResumeStore();
  store.loadSnapshot(createSnapshot(html));
  return store;
}

function createSnapshot(html: string): ResumeSnapshot {
  return {
    tree: parseResumeVTreeFromHtml(html)
  };
}

function createResumeHtml(): string {
  return `
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
  `;
}
