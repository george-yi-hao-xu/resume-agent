import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import { SettingsOverlay } from "./SettingsOverlay";
import "./ChatHeader.scss";

export const ChatHeader = observer(() => {
  const { chatStore } = useStore();

  return (
    <header className="chat-header">
      <div>
        <h1>Chat-to-DOM</h1>
        <p>Chat edits the resume preview</p>
      </div>
      <div className="chat-header-actions">
        <span className={chatStore.isWorking ? "status status-working" : "status"}>
          {chatStore.isWorking ? "Running" : "Ready"}
        </span>
        <SettingsOverlay />
      </div>
    </header>
  );
});
