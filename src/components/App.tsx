import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";
import "./App.scss";

const App = observer(function App() {
  return (
    <main className="app-shell">
      <ChatPanel />
      <PreviewPanel />
    </main>
  );
});

export default App;
