"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { VerificationRecord } from "@/lib/types";

type SessionSummary = Pick<
  VerificationRecord,
  "id" | "url" | "goal" | "status" | "passed" | "reason" | "duration_ms" | "created_at"
>;

const EXAMPLES = [
  {
    url: "https://the-internet.herokuapp.com/login",
    goal: "Log in with username 'tomsmith' and password 'SuperSecretPassword!' and confirm it succeeds.",
  },
  {
    url: "https://demo.realworld.io",
    goal: "The home page loads and shows a feed of articles with no errors.",
  },
  {
    url: "https://the-internet.herokuapp.com/login",
    goal: "Log in with wrong credentials and confirm an error message appears.",
  },
];

function Verdict({ passed, status }: { passed: boolean | null; status: string }) {
  if (status === "running") return <span className="mono text-accent">● running</span>;
  if (status === "error") return <span className="mono text-fail">⚠ error</span>;
  return passed ? (
    <span className="mono text-pass">✓ PASS</span>
  ) : (
    <span className="mono text-fail">✗ FAIL</span>
  );
}

export default function Console() {
  const [url, setUrl] = useState(EXAMPLES[0].url);
  const [goal, setGoal] = useState(EXAMPLES[0].goal);
  const [maxSteps, setMaxSteps] = useState(8);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VerificationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch("/api/sessions");
      const j = await r.json();
      setSessions(j.sessions ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const r = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, goal, maxSteps }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Verification failed");
      setResult(j as VerificationRecord);
      loadSessions();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-10">
        <Link href="/" className="mono text-accent text-sm hover:underline">
          computah://
        </Link>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight">Verification console</h1>
        <p className="mt-3 max-w-2xl text-muted">
          Give Computah a URL and a plain-English goal. It opens a real browser, drives it like a
          QA tester, and returns a verdict — running on{" "}
          <span className="text-foreground">InsForge</span> (Storage · Postgres · AI).
        </p>
      </header>

      <form onSubmit={run} className="rounded-xl border border-border bg-panel p-5 shadow-lg">
        <label className="mono mb-1 block text-xs text-muted">TARGET URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-app.vercel.app"
          className="mono w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="mono mb-1 mt-4 block text-xs text-muted">GOAL TO VERIFY</label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Log in with test@test.com / password and reach the dashboard."
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <div className="mt-4 flex items-center gap-4">
          <label className="mono text-xs text-muted">
            MAX STEPS
            <input
              type="number"
              min={1}
              max={15}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              className="mono ml-2 w-16 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={running}
            className="ml-auto rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {running ? "Verifying…" : "Verify ▸"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setUrl(ex.url);
                setGoal(ex.goal);
              }}
              className="mono rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:border-accent hover:text-foreground"
            >
              try: {ex.goal.slice(0, 38)}…
            </button>
          ))}
        </div>
      </form>

      {running && (
        <div className="mono mt-4 animate-pulse rounded-lg border border-border bg-panel px-4 py-3 text-sm text-accent">
          ● Computah is driving a browser through your app…
        </div>
      )}

      {error && (
        <div className="mono mt-4 rounded-lg border border-fail/40 bg-fail/10 px-4 py-3 text-sm text-fail">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-border bg-panel p-5">
          <div className="flex items-center justify-between">
            <Verdict passed={result.passed} status={result.status} />
            <span className="mono text-xs text-muted">
              {result.steps.length} steps · {result.duration_ms}ms
            </span>
          </div>
          <p className="mt-2 text-sm">{result.reason}</p>
          <Link
            href={`/sessions/${result.id}`}
            className="mono mt-3 inline-block text-sm text-accent hover:underline"
          >
            ▸ watch the replay
          </Link>
        </div>
      )}

      <section className="mt-12">
        <h2 className="mono mb-3 text-xs uppercase tracking-wider text-muted">
          Recent verifications
        </h2>
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
          {sessions.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted">
              No sessions yet. Run a verification above, or call the MCP tool{" "}
              <code className="mono text-accent">computah_verify</code> from your agent.
            </div>
          )}
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="flex items-center gap-4 px-4 py-3 transition hover:bg-background/50"
            >
              <Verdict passed={s.passed} status={s.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{s.goal}</div>
                <div className="mono truncate text-xs text-muted">{s.url}</div>
              </div>
              <span className="mono shrink-0 text-xs text-muted">
                {new Date(s.created_at).toLocaleTimeString()}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="mono mt-12 text-center text-xs text-muted">
        Computah · built for the InsForge Agentic Dev Tools Hackathon
      </footer>
    </main>
  );
}
