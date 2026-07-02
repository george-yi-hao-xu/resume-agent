import "./ChatComposer.scss";
import { useStore } from "../stores";
import { observer } from "mobx-react-lite";

export const ChatComposer = observer(() => {
  const { chatStore } = useStore();

  return (
    <form
      className="composer"
      onSubmit={async(e) => {
        e.preventDefault();
        await chatStore.submitInstruction();
      }}
    >
      <textarea
        value={chatStore.input}
        onChange={(e) => {
          chatStore.setInput(e.target.value);
        }}
        placeholder="Tell the editor what to change..."
        rows={3}
      />
      <button type="submit" disabled={!chatStore.canSubmit}>
        Apply
      </button>
    </form>
  );
});
