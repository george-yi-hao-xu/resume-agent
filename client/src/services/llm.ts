import type { PatchProviderResult, PreviewContext } from "../types";

export type OllamaHealthResult =
  | { ok: true }
  | { ok: false; reason: "offline" | "model_missing"; message: string };

export async function getPatchesFromInstruction(
  instruction: string,
  model: string,
  apiBaseUrl: string,
  temperature: number,
  previewContext?: PreviewContext,
): Promise<PatchProviderResult> {
  const response = await fetch(apiUrl(apiBaseUrl, "/api/patches"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction, model, temperature, previewContext })
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
    const url = new URL(apiUrl(apiBaseUrl, "/api/health"));
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

export function apiUrl(apiBaseUrl: string, path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path}`;
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: unknown };
    return typeof data.detail === "string" ? data.detail : `${fallback} Backend returned ${response.status}.`;
  } catch {
    return `${fallback} Backend returned ${response.status}.`;
  }
}
