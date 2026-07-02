import type { PatchProviderResult } from "../types";

export type OllamaHealthResult =
  | { ok: true }
  | { ok: false; reason: "offline" | "model_missing"; message: string };

export async function getPatchesFromInstruction(
  instruction: string,
  model: string,
  apiBaseUrl: string,
  temperature: number,
): Promise<PatchProviderResult> {
  const response = await fetch(getApiUrl(apiBaseUrl, "/api/patches"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, model, temperature })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, "Patch request failed."));
  }

  return (await response.json()) as PatchProviderResult;
}

export async function checkOllamaHealth(
  apiBaseUrl: string,
  model: string,
  timeoutMs = 3000
): Promise<OllamaHealthResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const url = getApiUrl(apiBaseUrl, "/api/health");
    url.searchParams.set("model", model);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "offline",
        message: `Backend returned ${response.status}.`
      };
    }

    return (await response.json()) as OllamaHealthResult;
  } catch {
    return {
      ok: false,
      reason: "offline",
      message: "Backend is not reachable."
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function getApiUrl(apiBaseUrl: string, path: string): URL {
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl : `${apiBaseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  url.hash = "";
  return url;
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    return typeof data.detail === "string" ? data.detail : `${fallback} Backend returned ${response.status}.`;
  } catch {
    return `${fallback} Backend returned ${response.status}.`;
  }
}
