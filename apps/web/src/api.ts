import type { ScenarioState } from "@control-tower/domain";

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

export const apiMode = configuredApiUrl ? "api" : "local";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!configuredApiUrl) {
    throw new Error("VITE_API_URL is not configured.");
  }

  const response = await fetch(`${configuredApiUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...options?.headers
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchScenario(): Promise<ScenarioState> {
  return request<ScenarioState>("/scenario");
}

export async function resetScenario(): Promise<ScenarioState> {
  return request<ScenarioState>("/scenario/reset", { method: "POST" });
}

export async function stepScenario(): Promise<ScenarioState> {
  const result = await request<{ state: ScenarioState }>("/simulation/step", { method: "POST" });
  return result.state;
}

export async function runScenario(steps: number): Promise<ScenarioState> {
  return request<ScenarioState>("/simulation/run", {
    method: "POST",
    body: JSON.stringify({ steps })
  });
}
