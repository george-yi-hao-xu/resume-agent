import { observer } from "mobx-react-lite";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useStore } from "../stores";
import "./OperationResults.scss";

export const OperationResults = observer(() => {
	const { chatStore } = useStore();
	const results = chatStore.displayedResult ?? [];

	if (!results.length) {
		return null;
	}

	const hasError = results.some((result) => !result.ok);

	return (
		<div
			className={
				hasError
					? "operation-toast operation-toast-error"
					: "operation-toast"
			}
			role="status"
			aria-live="polite"
		>
			<div className="operation-toast-header">
				<span className="operation-toast-title">
					{hasError ? (
						<AlertCircle size={16} aria-hidden="true" />
					) : (
						<CheckCircle2 size={16} aria-hidden="true" />
					)}
					Updates
				</span>
				<button
					type="button"
					className="operation-toast-close"
					aria-label="Dismiss updates"
					title="Dismiss"
					onClick={() => {
						chatStore.clearDisplayedResult();
					}}
				>
					<X size={14} aria-hidden="true" />
				</button>
			</div>
			<div className="operation-toast-list">
				{results.map((result, index) => (
					<div
						key={`${result.action}-${index}`}
						className={
							result.ok
								? "operation-toast-item"
								: "operation-toast-item operation-toast-item-error"
						}
					>
						{result.message}
					</div>
				))}
			</div>
		</div>
	);
});
