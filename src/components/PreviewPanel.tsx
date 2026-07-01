import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { useStore } from "../stores";
import "./PreviewPanel.scss";


export function PreviewPanel() {
  const { resumeStore } = useStore();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    console.log("[App.useEffect:initializePreview]");
    resumeStore.initializePreview(iframeRef.current);
  }, []);

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
          resumeStore.setPreviewDocument(iframeRef.current?.contentDocument ?? undefined);
        }}
      />
    </section>
  );
}
