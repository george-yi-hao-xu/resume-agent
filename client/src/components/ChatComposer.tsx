import "./ChatComposer.scss";
import { useStore } from "../stores";
import { observer } from "mobx-react-lite";
import { MAX_TOKEN_CONTEXT } from "../constants";

export const ChatComposer = observer(() => {
  const { chatStore } = useStore();
  const usage = chatStore.lastUsage;
  const hasActualUsage = usage?.promptEvalCount !== undefined;
  const usagePercentage = hasActualUsage
    ? Math.min(100, Math.round(((usage.promptEvalCount ?? 0) / MAX_TOKEN_CONTEXT) * 100))
    : 0;

  return (
    <form
      className="composer"
      onSubmit={async(e) => {
        e.preventDefault();
        await chatStore.submitInstruction();
      }}
    >
      <textarea
        value={chatStore.input}
        onChange={(e) => {
          chatStore.setInput(e.target.value);
        }}
        placeholder="Tell the editor what to change..."
        rows={3}
      />
      <div className="composer-meta" title={hasActualUsage ? "Reported by Ollama from the last completed request." : "Waiting for Ollama usage from the first completed request."}>
        <span>
          {hasActualUsage
            ? `Last prompt ${usage.promptEvalCount?.toLocaleString()} / ${MAX_TOKEN_CONTEXT.toLocaleString()} tokens`
            : "Token usage appears after the first request"}
        </span>
        <span>
          {hasActualUsage ? `${usagePercentage}%` : "0%"}
          {usage?.evalCount !== undefined ? ` · Output ${usage.evalCount.toLocaleString()}` : ""}
        </span>
      </div>
      <div className="composer-context-meter" aria-hidden="true">
        <span style={{ width: `${usagePercentage}%` }} />
      </div>
      <button type="submit" disabled={!chatStore.canSubmit}>
        Apply
      </button>
    </form>
  );
});
