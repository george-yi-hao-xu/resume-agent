import "./ChatHeader.scss";

type ChatHeaderProps = {
  isWorking: boolean;
};

export function ChatHeader({ isWorking }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div>
        <h1>Chat-to-DOM</h1>
        <p>Chat edits the resume preview</p>
      </div>
      <span className={isWorking ? "status status-working" : "status"}>{isWorking ? "Running" : "Ready"}</span>
    </header>
  );
}
