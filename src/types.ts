export type UpdateCssPatch = {
  action: "update_css";
  selector: string;
  styles: Record<string, string>;
};

export type UpdateTextPatch = {
  action: "update_text";
  selector: string;
  text: string;
};

export type InsertHtmlPatch = {
  action: "insert_html";
  parent: string;
  position?: InsertPosition;
  html: string;
};

export type RemoveElementPatch = {
  action: "remove_element";
  selector: string;
};

export type UiPatch =
  | UpdateCssPatch
  | UpdateTextPatch
  | InsertHtmlPatch
  | RemoveElementPatch;

export type PatchResult = {
  ok: boolean;
  action: string;
  message: string;
};

export type PatchProviderResult = {
  patches: UiPatch[];
  provider: "ollama" | "mock";
  model?: string;
  note?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  patches?: UiPatch[];
  provider?: PatchProviderResult["provider"];
};
