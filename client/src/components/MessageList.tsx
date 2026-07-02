import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import "./MessageList.scss";

export const MessageList = observer(() => {
  const { chatStore } = useStore();

  return (
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
  );
});
