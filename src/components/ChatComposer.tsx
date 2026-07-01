import type { FormEvent } from "react";
import "./ChatComposer.scss";

type ChatComposerProps = {
  canSubmit: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ChatComposer({ canSubmit, input, onInputChange, onSubmit }: ChatComposerProps) {
  console.log("[ChatComposer]", { canSubmit, input });
  return (
    <form className="composer" onSubmit={onSubmit}>
      <textarea
        value={input}
        onChange={(event) => {
          console.log("[ChatComposer.onChange]", { value: event.target.value });
          onInputChange(event.target.value);
        }}
        placeholder="Tell the editor what to change..."
        rows={3}
      />
      <button type="submit" disabled={!canSubmit}>
        Apply
      </button>
    </form>
  );
}
