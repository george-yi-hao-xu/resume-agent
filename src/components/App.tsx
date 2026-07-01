import { FormEvent, useEffect, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { EditorStore } from "../stores/editorStore";

const App = observer(function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const store = useMemo(() => new EditorStore(), []);

  useEffect(() => {
    store.initializePreview(iframeRef.current);
  }, [store]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await store.submitInstruction();
  }

  return (
    <main className="app-shell">
      <section className="chat-panel" aria-label="Editor chat">
        <header className="chat-header">
          <div>
            <h1>Chat-to-DOM</h1>
            <p>Chat edits the resume preview</p>
          </div>
          <span className={store.isWorking ? "status status-working" : "status"}>{store.isWorking ? "Running" : "Ready"}</span>
        </header>

        <div className="examples" aria-label="Example prompts">
          {store.examples.map((example) => (
            <button key={example} type="button" onClick={() => store.useExample(example)}>
              {example}
            </button>
          ))}
        </div>

        <div className="messages" aria-live="polite">
          {store.messages.map((message) => (
            <article key={message.id} className={`message message-${message.role}`}>
              <div className="message-meta">
                <span>{message.role}</span>
                {message.provider && <span>{message.provider}</span>}
              </div>
              <p>{message.content}</p>
              {message.patches && (
                <pre>{JSON.stringify(message.patches, null, 2)}</pre>
              )}
            </article>
          ))}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={store.input}
            onChange={(event) => store.setInput(event.target.value)}
            placeholder="Tell the editor what to change..."
            rows={3}
          />
          <button type="submit" disabled={!store.canSubmit}>
            Apply
          </button>
        </form>

        <div className="results" aria-label="Patch results">
          {store.results.map((result, index) => (
            <span key={`${result.action}-${index}`} className={result.ok ? "result-ok" : "result-error"}>
              {result.message}
            </span>
          ))}
        </div>
      </section>

      <section className="preview-panel" aria-label="Live preview">
        <div className="preview-toolbar">
          <span>Live preview</span>
          <span>iframe sandbox</span>
        </div>
        <iframe
          ref={iframeRef}
          title="Editable page preview"
          sandbox="allow-same-origin"
          onLoad={() => store.setPreviewDocument(iframeRef.current?.contentDocument ?? undefined)}
        />
      </section>
    </main>
  );
});

export default App;
