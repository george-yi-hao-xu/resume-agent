import { FormEvent, useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";
import "./App.scss";

const App = observer(function App() {
  console.log("[App]");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { chatStore, resumeStore } = useStore();

  useEffect(() => {
    console.log("[App.useEffect:initializePreview]");
    resumeStore.initializePreview(iframeRef.current);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    console.log("[App.handleSubmit]");
    event.preventDefault();
    await chatStore.submitInstruction();
  }

  return (
    <main className="app-shell">
      <ChatPanel chatStore={chatStore} onSubmit={handleSubmit} />
      <PreviewPanel iframeRef={iframeRef} />
    </main>
  );
});

export default App;
