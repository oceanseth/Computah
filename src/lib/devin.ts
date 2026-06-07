/**
 * Devin (devin.ai) adapter — creates an autonomous coding session via the Devin
 * API. Sibling to src/lib/replicas.ts; used when a replicant's coding_agent is
 * "devin". Credentials resolve per project (project_settings.devin_api_key)
 * with a DEVIN_API_KEY env fallback. Server-side only.
 *
 * Docs: https://docs.devin.ai · API: POST https://api.devin.ai/v1/sessions
 */

const API_BASE = process.env.DEVIN_API_BASE || "https://api.devin.ai";

export function envApiKey(): string | undefined {
  return process.env.DEVIN_API_KEY || undefined;
}

async function api(apiKey: string, pathname: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let json: Record<string, unknown>;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = (json?.error as string) || (json?.message as string) || `HTTP ${res.status}`;
    throw new Error(`Devin API: ${msg}`);
  }
  return json;
}

const COMMIT_INSTRUCTION =
  "Work in the connected GitHub repository. When done, commit on a feature branch, push it, and open a pull request.";

export type DevinSession = { id: string; status: string; url: string };

/** Spin up a Devin session to carry out a build instruction. */
export async function createDevinSession(
  apiKey: string,
  opts: { message: string; name?: string }
): Promise<DevinSession> {
  const message = (opts.message || "").trim();
  if (!message) throw new Error("A task (message) is required");

  const data = await api(apiKey, "/v1/sessions", {
    method: "POST",
    body: {
      prompt: `${message}\n\n${COMMIT_INSTRUCTION}`,
      idempotent: true,
    },
  });

  const id = String(data.session_id || data.id || "");
  const url =
    (data.url as string) ||
    (id ? `https://app.devin.ai/sessions/${id.replace(/^devin-/, "")}` : "https://app.devin.ai");
  return { id, status: String(data.status_enum || data.status || "running"), url };
}

/** Fetch current state of a Devin session (for status refresh). */
export async function getDevinSession(apiKey: string, id: string): Promise<DevinSession> {
  if (!id) throw new Error("session id is required");
  const data = await api(apiKey, `/v1/session/${id}`);
  const url =
    (data.url as string) || `https://app.devin.ai/sessions/${id.replace(/^devin-/, "")}`;
  return { id, status: String(data.status_enum || data.status || "running"), url };
}
