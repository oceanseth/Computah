import type { Settings } from "./config";

/**
 * Minimal InsForge client over plain fetch (robust in React Native / Hermes).
 *
 * - Database: PostgREST-style under `/api/database/records/{table}`
 * - AI:       OpenAI-compatible under `/api/ai/chat/completion`
 *
 * Mirrors the desktop app's tables: sessions, transcript_segments, memories.
 */

export type Memory = {
  id?: string;
  session_id?: string | null;
  kind: "note" | "action_item" | "question" | "decision" | "entity";
  content: string;
  tags: string[];
  source_excerpt?: string | null;
  created_at?: string;
};

export type SessionRow = {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
};

function base(s: Settings) {
  // Be forgiving about how the URL was entered: trim, strip trailing slashes,
  // and prepend https:// if no scheme was given (a missing scheme is what
  // triggers iOS "protocol error" / unsupported-URL failures).
  let u = (s.insforgeUrl || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function headers(s: Settings, prefer?: string): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${s.insforgeKey}`,
  };
  if (prefer) h.Prefer = prefer;
  return h;
}

async function records<T = unknown>(
  s: Settings,
  method: string,
  path: string,
  body?: unknown,
  prefer = "return=representation"
): Promise<T> {
  const res = await fetch(`${base(s)}/api/database/records/${path}`, {
    method,
    headers: headers(s, prefer),
    body: body == null ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`InsForge ${method} ${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function createSession(s: Settings, title: string | null): Promise<string | null> {
  const rows = await records<SessionRow[]>(s, "POST", "sessions", [{ title }]);
  return rows?.[0]?.id ?? null;
}

export async function endSession(s: Settings, id: string): Promise<void> {
  await records(s, "PATCH", `sessions?id=eq.${id}`, { ended_at: new Date().toISOString() });
}

export async function insertSegment(
  s: Settings,
  sessionId: string | null,
  text: string,
  meta: { startMs?: number; endMs?: number } = {}
): Promise<void> {
  await records(
    s,
    "POST",
    "transcript_segments",
    [
      {
        session_id: sessionId,
        text,
        start_ms: meta.startMs ?? null,
        end_ms: meta.endMs ?? null,
        is_final: true,
      },
    ],
    "return=minimal"
  );
}

export async function insertMemories(
  s: Settings,
  sessionId: string | null,
  memories: Memory[]
): Promise<void> {
  if (!memories.length) return;
  await records(
    s,
    "POST",
    "memories",
    memories.map((m) => ({
      session_id: sessionId,
      kind: m.kind,
      content: m.content,
      tags: m.tags ?? [],
      source_excerpt: m.source_excerpt ?? null,
    })),
    "return=minimal"
  );
}

export async function listRecentMemories(s: Settings, limit = 50): Promise<Memory[]> {
  return records<Memory[]>(
    s,
    "GET",
    `memories?order=created_at.desc&limit=${limit}`,
    undefined,
    ""
  );
}

export async function listSessions(s: Settings, limit = 20): Promise<SessionRow[]> {
  return records<SessionRow[]>(
    s,
    "GET",
    `sessions?order=started_at.desc&limit=${limit}`,
    undefined,
    ""
  );
}

/** OpenAI-compatible chat completion via the InsForge AI gateway. Returns text. */
export async function chat(
  s: Settings,
  model: string,
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<string> {
  const res = await fetch(`${base(s)}/api/ai/chat/completion`, {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`InsForge AI ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  // Gateway returns { text, metadata }; SDK normalizes to choices — handle both.
  return (
    data?.text ??
    data?.choices?.[0]?.message?.content ??
    ""
  );
}
