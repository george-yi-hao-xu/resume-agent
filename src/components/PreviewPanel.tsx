import { useRef } from "react";
import { Printer } from "lucide-react";
import { useStore } from "../stores";
import "./PreviewPanel.scss";
import { observer } from "mobx-react-lite";

export const PreviewPanel = observer(() => {
  const { resumeStore } = useStore();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <section className="preview-panel" aria-label="Live preview">
      <div className="preview-toolbar">
        <span>Live preview</span>
        <div className="preview-toolbar-actions">
          <span>iframe sandbox</span>
          <button
            type="button"
            className="preview-export-button"
            disabled={!resumeStore.previewDocument}
            onClick={() => {
              resumeStore.printPreview();
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
        srcDoc={resumeStore.html}
        sandbox="allow-same-origin allow-modals"
        onLoad={() => {
          resumeStore.setPreviewDocument(iframeRef.current?.contentDocument ?? undefined);
        }}
      />
    </section>
  );
});
