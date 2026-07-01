import type { RefObject } from "react";
import { useStore } from "../stores";
import "./PreviewPanel.scss";

type PreviewPanelProps = {
  iframeRef: RefObject<HTMLIFrameElement | null>;
};

export function PreviewPanel({ iframeRef }: PreviewPanelProps) {
  console.log("[PreviewPanel]");
  const { resumeStore } = useStore();

  return (
    <section className="preview-panel" aria-label="Live preview">
      <div className="preview-toolbar">
        <span>Live preview</span>
        <span>iframe sandbox</span>
      </div>
      <iframe
        ref={iframeRef}
        title="Editable page preview"
        sandbox="allow-same-origin"
        onLoad={() => {
          console.log("[PreviewPanel.onLoad]");
          resumeStore.setPreviewDocument(iframeRef.current?.contentDocument ?? undefined);
        }}
      />
    </section>
  );
}
