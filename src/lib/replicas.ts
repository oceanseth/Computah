/**
 * Replicas adapter — spins up a background coding agent ("replicant") in an
 * isolated cloud workspace. Port of voice-app/desktop-app/src/main/replicas.js.
 * Docs: https://docs.tryreplicas.com
 *
 * Credentials resolve per project (project_settings) with env fallback —
 * REPLICAS_API_KEY / REPLICAS_ENVIRONMENT_ID. Server-side only.
 */

const API_BASE = process.env.REPLICAS_API_BASE || "https://api.tryreplicas.com";
export const REPLICAS_DASHBOARD_URL =
  process.env.REPLICAS_DASHBOARD_URL || "https://tryreplicas.com/dashboard";

export type ReplicaCredentials = { apiKey: string; environmentId: string };

export function envCredentials(): Partial<ReplicaCredentials> {
  return {
    apiKey: process.env.REPLICAS_API_KEY || undefined,
    environmentId: process.env.REPLICAS_ENVIRONMENT_ID || undefined,
  };
}

async function api(
  apiKey: string,
  pathname: string,
  init: { method?: string; body?: unknown } = {}
) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Opt into the non-blocking create behavior; the workspace boots async.
      "X-Replicas-Api-Version": "2026-05-17",
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
    throw new Error(`Replicas API: ${msg}`);
  }
  return json;
}

// Replica name must not contain whitespace.
export function slugifyName(input: string): string {
  const base =
    (input || "voice-build")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "voice-build";
  return `${base}-${Date.now().toString(36)}`;
}

// Appended to every build instruction so the agent's work lands in the repo.
const COMMIT_INSTRUCTION =
  "Work inside the mounted GitHub repository. When done, commit your changes on a feature branch, push it, and open a pull request.";

type ReplicaState = { id: string; name: string; status: string; url: string };

export async function createReplica(
  creds: ReplicaCredentials,
  opts: { message: string; name?: string; codingAgent?: string; model?: string }
): Promise<ReplicaState> {
  const message = (opts.message || "").trim();
  if (!message) throw new Error("A build instruction (message) is required");

  const body: Record<string, unknown> = {
    name: slugifyName(opts.name || message),
    message: `${message}\n\n${COMMIT_INSTRUCTION}`,
    environment_id: creds.environmentId,
    coding_agent: opts.codingAgent === "codex" ? "codex" : "claude",
    lifecycle_policy: "default",
  };
  if (opts.model) body.model = opts.model;

  const data = await api(creds.apiKey, "/v1/replica", { method: "POST", body });
  const replica = (data.replica as Record<string, string>) || (data as Record<string, string>);
  return {
    id: replica.id,
    name: replica.name,
    status: replica.status,
    url: REPLICAS_DASHBOARD_URL, // no per-replica URL in the API
  };
}

/** Send a follow-up message to a live replica (wakes it if sleeping). */
export async function sendReplicaMessage(
  creds: ReplicaCredentials,
  replicaId: string,
  message: string
): Promise<{ status: string }> {
  const data = await api(creds.apiKey, `/v1/replica/${replicaId}/messages`, {
    method: "POST",
    body: { message },
  });
  return { status: (data.status as string) || "sent" };
}

/** Idempotently set an env var on the environment (new replicant VMs inherit it). */
export async function ensureEnvironmentVariable(
  creds: ReplicaCredentials,
  key: string,
  value: string
): Promise<void> {
  try {
    await api(creds.apiKey, `/v1/environments/${creds.environmentId}/variables`, {
      method: "POST",
      body: { key, value },
    });
  } catch (err) {
    // unique(key, environment) — already set is fine
    if (!/unique|exists|conflict|409/i.test((err as Error).message)) throw err;
  }
}

export async function getReplica(creds: ReplicaCredentials, id: string): Promise<ReplicaState> {
  if (!id) throw new Error("replica id is required");
  const data = await api(creds.apiKey, `/v1/replica/${id}`);
  const replica = (data.replica as Record<string, string>) || (data as Record<string, string>);
  return {
    id: replica.id,
    name: replica.name,
    status: replica.status,
    url: REPLICAS_DASHBOARD_URL,
  };
}
