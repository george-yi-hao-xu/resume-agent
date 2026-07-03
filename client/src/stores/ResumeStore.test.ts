import { PatchAction } from "../types";
import { ResumeStore } from "./ResumeStore";

describe("ResumeStore history", () => {
  it("records applied changes and can undo and redo them", () => {
    const store = new ResumeStore();
    store.setPreviewDocument(createResumeDocument());

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
    store.setPreviewDocument(createResumeDocument());

    store.applyPatches([
      {
        action: PatchAction.UpdateText,
        selector: ".resume-name",
        text: "Grace Liu"
      }
    ]);
    store.undo();
    store.setPreviewDocument(parseHtml(store.html));

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
    store.setPreviewDocument(createResumeDocument());

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
    store.setPreviewDocument(createResumeDocument());
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
          </article>
        </main>
      </body>
    </html>
  `);
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}
