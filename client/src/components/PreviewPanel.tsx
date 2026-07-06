import { useRef } from "react";
import { Printer, Redo2, Undo2 } from "lucide-react";
import { useStore } from "../stores";
import "./PreviewPanel.scss";
import { observer } from "mobx-react-lite";
import { PAGE_LAYOUT } from "../types";

export const PreviewPanel = observer(() => {
  const { resumeStore } = useStore();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <section className="preview-panel" aria-label="Live preview">
      <div className="preview-toolbar">
        <span>Live preview</span>
        <div className="preview-toolbar-actions">
          <span>iframe sandbox</span>
          <label className="preview-layout-control">
            <span className="preview-layout-label">Page layout</span>
            <select
              className="preview-layout-select"
              value={resumeStore.pageLayout}
              onChange={(event) => {
                const v = event.target.value as typeof resumeStore.pageLayout;
                if (Object.values(PAGE_LAYOUT).includes(v)) {
                  resumeStore.setPageLayout(v);
                }
              }}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </label>
          <div
            className="preview-history-actions"
            aria-label="Preview history controls"
          >
            <button
              type="button"
              className="preview-icon-button"
              aria-label="Undo preview change"
              title="Undo"
              disabled={!resumeStore.canUndo}
              onClick={() => {
                resumeStore.undo();
              }}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="preview-icon-button"
              aria-label="Redo preview change"
              title="Redo"
              disabled={!resumeStore.canRedo}
              onClick={() => {
                resumeStore.redo();
              }}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="preview-export-button"
            onClick={() => {
              const previewWindow = iframeRef.current?.contentWindow;
              previewWindow?.focus();
              previewWindow?.print();
            }}
          >
            <Printer size={16} aria-hidden="true" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>
      <iframe
        ref={iframeRef}
        title="Editable page preview"
        srcDoc={resumeStore.srcDoc}
        sandbox="allow-same-origin allow-modals"
      />
    </section>
  );
});
