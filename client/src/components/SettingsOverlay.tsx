import { Settings, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useId, useState } from "react";
import { useStore } from "../stores";
import "./SettingsOverlay.scss";

export const SettingsOverlay = observer(() => {
  const { llmStatusStore } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="settings-trigger"
        aria-label="Open settings"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(true);
        }}
      >
        <Settings size={18} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="settings-layer" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="settings-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <header className="settings-overlay-header">
              <h2 id={titleId}>Settings</h2>
              <button
                type="button"
                className="settings-close"
                aria-label="Close settings"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="settings-fields">
              <div className="settings-field">
                <span>Backend status</span>
                <strong>{llmStatusStore.backendLabel}</strong>
              </div>

              <div className="settings-field">
                <span>Backend message</span>
                <strong>{llmStatusStore.backendMessage}</strong>
              </div>

              <div className="settings-field">
                <span>LLM status</span>
                <strong>{llmStatusStore.llmLabel}</strong>
              </div>

              <div className="settings-field">
                <span>LLM message</span>
                <strong>{llmStatusStore.llmMessage}</strong>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
});
