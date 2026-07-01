import "./ExamplePrompts.scss";

type ExamplePromptsProps = {
  examples: readonly string[];
  onSelect: (example: string) => void;
};

export function ExamplePrompts({ examples, onSelect }: ExamplePromptsProps) {
  return (
    <div className="examples" aria-label="Example prompts">
      {examples.map((example) => (
        <button key={example} type="button" onClick={() => {
          onSelect(example);
        }}>
          {example}
        </button>
      ))}
    </div>
  );
}
