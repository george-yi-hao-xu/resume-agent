import { observer } from "mobx-react-lite";
import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ExamplePrompts } from "./ExamplePrompts";
import { MessageList } from "./MessageList";
import { PatchResults } from "./PatchResults";
import "./ChatPanel.scss";
import { useStore } from "../stores";

export const ChatPanel = observer(() => {
  const { chatStore } = useStore()

  return (
    <section className="chat-panel" aria-label="Editor chat">
      <ChatHeader isWorking={chatStore.isWorking} />
      <ExamplePrompts examples={chatStore.examples} onSelect={(example) => chatStore.useExample(example)} />
      <MessageList messages={chatStore.messages} />
      <ChatComposer />
      <PatchResults results={chatStore.results} />
    </section>
  );
});
