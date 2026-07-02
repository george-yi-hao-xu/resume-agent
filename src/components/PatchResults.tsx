import { observer } from "mobx-react-lite";
import { useStore } from "../stores";
import "./PatchResults.scss";

export const PatchResults = observer(() => {
  const { chatStore } = useStore();

  return (
    <div className="results" aria-label="Patch results">
      {chatStore.results.map((result, index) => (
        <span key={`${result.action}-${index}`} className={result.ok ? "result-ok" : "result-error"}>
          {result.message}
        </span>
      ))}
    </div>
  );
});
