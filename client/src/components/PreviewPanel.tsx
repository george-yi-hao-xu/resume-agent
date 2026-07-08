import { useEffect, useRef } from "react";
import { Lock, Printer, Redo2, Undo2, Unlock } from "lucide-react";
import { useStore } from "../stores";
import "./PreviewPanel.scss";
import { observer } from "mobx-react-lite";
import { PAGE_LAYOUT, PatchAction } from "../types";
import type { ResumeDiffOp } from "../types";

const DIRECT_EDIT_STYLE_ID = "direct-edit-styles";

// when user focus/edit on a ele
const DIRECT_EDIT_STYLE = `
[data-text-leaf][contenteditable="true"]:hover {
	outline: 1px dashed rgba(0, 0, 0, 0.35);
	cursor: text;
}
[data-text-leaf][contenteditable="true"]:focus {
	outline: 2px solid #2563eb;
	outline-offset: 2px;
}
`;

export const PreviewPanel = observer(() => {
	const { resumeStore } = useStore();

	const iframeRef = useRef<HTMLIFrameElement | null>(null);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) {
			return;
		}

		const abortController = new AbortController();
		const { signal } = abortController;

		const handleBlur = (event: Event): void => {
			const target = event.target as HTMLElement;
			if (!target.hasAttribute("data-text-leaf")) {
				return;
			}

			const wd = target.getAttribute("data-wd");
			if (!wd) {
				return;
			}

			const newText = target.textContent ?? "";
			const diff: ResumeDiffOp = {
				op: PatchAction.DiffReplace,
				path: `${wd}/value`,
				value: newText,
			};
			resumeStore.applyDiff([diff]);
		};

		const injectEditStyles = (doc: Document): void => {
			if (doc.getElementById(DIRECT_EDIT_STYLE_ID)) {
				return;
			}
			const style = doc.createElement("style");
			style.id = DIRECT_EDIT_STYLE_ID;
			style.textContent = DIRECT_EDIT_STYLE;
			doc.head.appendChild(style);
		};

		const handleLoad_manageEditMode = (): void => {
			const doc = iframe.contentDocument;
			if (!doc) {
				return;
			}

			if (resumeStore.directEditMode) {
				injectEditStyles(doc);
			}

			const leaves = doc.querySelectorAll("[data-text-leaf]");
			leaves.forEach((el) => {
				if (resumeStore.directEditMode) {
					el.setAttribute("contenteditable", "true");
					el.addEventListener("blur", handleBlur, { signal });
				} else {
					el.removeAttribute("contenteditable");
					el.removeEventListener("blur", handleBlur);
				}
			});
		};

		iframe.addEventListener("load", handleLoad_manageEditMode, { signal });
		handleLoad_manageEditMode();

		return () => {
			abortController.abort();
		};
	}, [resumeStore.directEditMode, resumeStore.srcDoc, resumeStore]);

	return (
		<section
			className={["preview-panel", resumeStore.directEditMode ? "direct-edit-mode" : ""].filter(Boolean) .join(" ")}
			aria-label="Live preview"
		>
			<div className="preview-toolbar">
				<span>Live preview</span>
				<div className="preview-toolbar-actions">
					<span>iframe sandbox</span>
					<button
						type="button"
						className={["preview-icon-button", resumeStore.directEditMode ? "active" : "" ].filter(Boolean).join(" ")}
						aria-label={ resumeStore.directEditMode ? "Lock direct editing" : "Unlock direct editing" }
						title={ resumeStore.directEditMode ? "Lock editing" : "Unlock editing" }
						onClick={() => { resumeStore.toggleDirectEditMode() }}
					>
						{resumeStore.directEditMode ? (
							<Unlock size={16} aria-hidden="true" />
						) : (
							<Lock size={16} aria-hidden="true" />
						)}
					</button>
					<label className="preview-layout-control">
						<span className="preview-layout-label">
							Page layout
						</span>
						<select
							className="preview-layout-select"
							value={resumeStore.pageLayout}
							onChange={(event) => {
								const v = event.target
									.value as typeof resumeStore.pageLayout;
								if (Object.values(PAGE_LAYOUT).includes(v)) {
									resumeStore.setPageLayout(v);
								}
							}}
						>
							<option value="vertical">Vertical</option>
							<option value="horizontal">Horizontal</option>
						</select>
					</label>
					<div
						className="preview-history-actions"
						aria-label="Preview history controls"
					>
						<button
							type="button"
							className="preview-icon-button"
							aria-label="Undo preview change"
							title="Undo"
							disabled={!resumeStore.canUndo}
							onClick={() => {
								resumeStore.undo();
							}}
						>
							<Undo2 size={16} aria-hidden="true" />
						</button>
						<button
							type="button"
							className="preview-icon-button"
							aria-label="Redo preview change"
							title="Redo"
							disabled={!resumeStore.canRedo}
							onClick={() => {
								resumeStore.redo();
							}}
						>
							<Redo2 size={16} aria-hidden="true" />
						</button>
					</div>
					<button
						type="button"
						className="preview-export-button"
						onClick={() => {
							const previewWindow =
								iframeRef.current?.contentWindow;
							previewWindow?.focus();
							previewWindow?.print();
						}}
					>
						<Printer size={16} aria-hidden="true" />
						<span>Export PDF</span>
					</button>
				</div>
			</div>
			<iframe
				ref={iframeRef}
				title="Editable page preview"
				srcDoc={resumeStore.srcDoc}
				sandbox="allow-same-origin allow-modals"
			/>
		</section>
	);
});
