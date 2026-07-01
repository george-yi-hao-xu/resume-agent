import type { PatchResult } from "../types";
import "./PatchResults.scss";

type PatchResultsProps = {
  results: PatchResult[];
};

export function PatchResults({ results }: PatchResultsProps) {
  console.log("[PatchResults]", { count: results.length, results });
  return (
    <div className="results" aria-label="Patch results">
      {results.map((result, index) => (
        <span key={`${result.action}-${index}`} className={result.ok ? "result-ok" : "result-error"}>
          {result.message}
        </span>
      ))}
    </div>
  );
}
