import type { ChatMessage } from "../types";
import "./MessageList.scss";

type MessageListProps = {
  messages: ChatMessage[];
};

export function MessageList({ messages }: MessageListProps) {
  console.log("[MessageList]", { count: messages.length });
  return (
    <div className="messages" aria-live="polite">
      {messages.map((message) => (
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
}
