import { FormEvent, useEffect, useMemo, useRef } from "react";
import { observer } from "mobx-react-lite";
import { ChatStore } from "../stores/chatStore";
import { ResumeStore } from "../stores/resumeStore";

const App = observer(function App() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resumeStore = useMemo(() => new ResumeStore(), []);
  const chatStore = useMemo(() => new ChatStore(resumeStore), [resumeStore]);

  useEffect(() => {
    resumeStore.initializePreview(iframeRef.current);
  }, [resumeStore]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await chatStore.submitInstruction();
  }

  return (
    <main className="app-shell">
      <section className="chat-panel" aria-label="Editor chat">
        <header className="chat-header">
          <div>
            <h1>Chat-to-DOM</h1>
            <p>Chat edits the resume preview</p>
          </div>
          <span className={chatStore.isWorking ? "status status-working" : "status"}>{chatStore.isWorking ? "Running" : "Ready"}</span>
        </header>

        <div className="examples" aria-label="Example prompts">
          {chatStore.examples.map((example) => (
            <button key={example} type="button" onClick={() => chatStore.useExample(example)}>
              {example}
            </button>
          ))}
        </div>

        <div className="messages" aria-live="polite">
          {chatStore.messages.map((message) => (
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
            value={chatStore.input}
            onChange={(event) => chatStore.setInput(event.target.value)}
            placeholder="Tell the editor what to change..."
            rows={3}
          />
          <button type="submit" disabled={!chatStore.canSubmit}>
            Apply
          </button>
        </form>

        <div className="results" aria-label="Patch results">
          {chatStore.results.map((result, index) => (
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
          onLoad={() => resumeStore.setPreviewDocument(iframeRef.current?.contentDocument ?? undefined)}
        />
      </section>
    </main>
  );
});

export default App;
