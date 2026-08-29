import { ChatComposer } from "./ChatComposer";
import { ChatHeader } from "./ChatHeader";
import { ExamplePrompts } from "./ExamplePrompts";
import { MessageList } from "./MessageList";
import { OperationResults } from "./OperationResults";
import "./ChatPanel.scss";

export function ChatPanel() {
	return (
		<section className="chat-panel" aria-label="Editor chat">
			<ChatHeader />
			<ExamplePrompts />
			<MessageList />
			<ChatComposer />
			<OperationResults />
		</section>
	);
}
