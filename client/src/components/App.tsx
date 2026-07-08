import { observer } from "mobx-react-lite";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";
import "./App.scss";
import { useStore } from "../stores";
import { useEffect } from "react";

const App = observer(() => {
	const root = useStore()

	useEffect(() => {
		window['rootStore'] = root
	}, [root])

	return (
		<main className="app-shell">
			<ChatPanel />
			<PreviewPanel />
		</main>
	);
});

export default App;
