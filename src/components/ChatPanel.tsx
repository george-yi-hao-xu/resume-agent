import type { FormEvent } from "react";
import { observer } from "mobx-react-lite";
import { ChatStore } from "../stores/chatStore";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ExamplePrompts } from "./ExamplePrompts";
import { MessageList } from "./MessageList";
import { PatchResults } from "./PatchResults";
import "./ChatPanel.scss";

type ChatPanelProps = {
  chatStore: ChatStore;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export const ChatPanel = observer(function ChatPanel({ chatStore, onSubmit }: ChatPanelProps) {
  console.log("[ChatPanel]", {
    isWorking: chatStore.isWorking,
    messageCount: chatStore.messages.length,
    resultCount: chatStore.results.length
  });
  return (
    <section className="chat-panel" aria-label="Editor chat">
      <ChatHeader isWorking={chatStore.isWorking} />
      <ExamplePrompts examples={chatStore.examples} onSelect={(example) => chatStore.useExample(example)} />
      <MessageList messages={chatStore.messages} />
      <ChatComposer
        canSubmit={chatStore.canSubmit}
        input={chatStore.input}
        onInputChange={(value) => chatStore.setInput(value)}
        onSubmit={onSubmit}
      />
      <PatchResults results={chatStore.results} />
    </section>
  );
});
