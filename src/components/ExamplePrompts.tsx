import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import "./ExamplePrompts.scss";

export const ExamplePrompts = observer(() => {
  const { chatStore } = useStore();

  return (
    <div className="examples" aria-label="Example prompts">
      {chatStore.EXAMPLES.map((example) => (
        <button key={example} type="button" onClick={() => {
          chatStore.useExample(example);
        }}>
          {example}
        </button>
      ))}
    </div>
  );
});
