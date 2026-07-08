import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./components/App";
import { RootStore, StoreProvider } from "./stores";
import "./styles/base.scss";

const rootStore = new RootStore();

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<StoreProvider store={rootStore}>
			<App />
		</StoreProvider>
	</StrictMode>,
);
