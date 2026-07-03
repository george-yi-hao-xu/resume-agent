import { observer } from "mobx-react-lite";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useStore } from "../stores";
import "./PatchResults.scss";

export const PatchResults = observer(() => {
  const { chatStore } = useStore();
  const results = chatStore.displayedResult ?? [];

  if (!results.length) {
    return null;
  }

  const hasError = results.some((result) => !result.ok);

  return (
    <div className={hasError ? "patch-toast patch-toast-error" : "patch-toast"} role="status" aria-live="polite">
      <div className="patch-toast-header">
        <span className="patch-toast-title">
          {hasError ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          Updates
        </span>
        <button
          type="button"
          className="patch-toast-close"
          aria-label="Dismiss updates"
          title="Dismiss"
          onClick={() => {
            chatStore.clearDisplayedResult();
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="patch-toast-list">
        {results.map((result, index) => (
          <div key={`${result.action}-${index}`} className={result.ok ? "patch-toast-item" : "patch-toast-item patch-toast-item-error"}>
            {result.message}
          </div>
        ))}
      </div>
    </div>
  );
});
