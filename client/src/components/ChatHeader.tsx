import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import { SettingsOverlay } from "./SettingsOverlay";
import "./ChatHeader.scss";

export const ChatHeader = observer(() => {
	const { chatStore, llmStatusStore, saveLoadStore } = useStore();
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const handleImport = async (file: File | undefined): Promise<void> => {
		if (!file) {
			return;
		}

		try {
			await saveLoadStore.importFile(file);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not import snapshot.";
			window.alert(message);
		} finally {
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	return (
		<header className="chat-header">
			<div>
				<h1>Resume Bro</h1>
				<p>Talk to this bro, and bro will update ur resume</p>
			</div>
			<div className="chat-header-actions">
				<div className="status-con">
					<span
						className={`status status-${llmStatusStore.backendStatus}`}
						title={llmStatusStore.backendMessage}
					>
						Backend: {llmStatusStore.backendLabel}
					</span>
					<span
						className={
							chatStore.isWorking
								? "status status-working"
								: `status status-${llmStatusStore.llmStatus}`
						}
						title={
							chatStore.isWorking
								? "Generating patches."
								: llmStatusStore.llmMessage
						}
					>
						LLM:{" "}
						{chatStore.isWorking
							? "Running"
							: llmStatusStore.llmLabel}
					</span>
				</div>
				<div className="redo-undo">
					<button
						type="button"
						className="snapshot-action"
						aria-label="Export snapshot"
						title="Export snapshot"
						onClick={() => {
							saveLoadStore.downloadSnapshot();
						}}
					>
						<Download size={18} aria-hidden="true" />
					</button>
					<button
						type="button"
						className="snapshot-action"
						aria-label="Import snapshot"
						title="Import snapshot"
						onClick={() => {
							fileInputRef.current?.click();
						}}
					>
						<Upload size={18} aria-hidden="true" />
					</button>
					<input
						ref={fileInputRef}
						className="snapshot-file-input"
						type="file"
						accept="application/json,.json"
						onChange={(event) => {
							void handleImport(event.target.files?.[0]);
						}}
					/>
					<SettingsOverlay />
				</div>
			</div>
		</header>
	);
});
