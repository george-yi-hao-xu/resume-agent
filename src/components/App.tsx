import { observer } from "mobx-react-lite";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";
import "./App.scss";

const App = observer(() => {
  return (
    <main className="app-shell">
      <ChatPanel />
      <PreviewPanel />
    </main>
  );
});

export default App;
