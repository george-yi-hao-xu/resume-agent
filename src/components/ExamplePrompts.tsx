import "./ExamplePrompts.scss";

type ExamplePromptsProps = {
  examples: readonly string[];
  onSelect: (example: string) => void;
};

export function ExamplePrompts({ examples, onSelect }: ExamplePromptsProps) {
  console.log("[ExamplePrompts]", { count: examples.length });
  return (
    <div className="examples" aria-label="Example prompts">
      {examples.map((example) => (
        <button key={example} type="button" onClick={() => {
          console.log("[ExamplePrompts.onClick]", { example });
          onSelect(example);
        }}>
          {example}
        </button>
      ))}
    </div>
  );
}
