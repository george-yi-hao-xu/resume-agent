import { Settings, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useId, useState } from "react";
import { useStore } from "../stores";
import "./SettingsOverlay.scss";

export const SettingsOverlay = observer(() => {
  const { settingStore } = useStore();
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
              <label className="settings-field">
                <span>Model</span>
                <input
                  type="text"
                  value={settingStore.llmName}
                  onChange={(event) => {
                    settingStore.updateLlmName(event.target.value);
                  }}
                />
              </label>

              <label className="settings-field">
                <span>API URL</span>
                <input
                  type="url"
                  value={settingStore.backEndUrl}
                  onChange={(event) => {
                    settingStore.updateBackEndUrl(event.target.value);
                  }}
                />
              </label>

              <label className="settings-field">
                <span>Temperature</span>
                <div className="settings-range-row">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settingStore.temperature}
                    onChange={(event) => {
                      settingStore.updateTemperature(Number(event.target.value));
                    }}
                  />
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settingStore.temperature}
                    onChange={(event) => {
                      settingStore.updateTemperature(Number(event.target.value));
                    }}
                  />
                </div>
              </label>
            </div>
          </section>
        </div>
      )}
    </>
  );
});
