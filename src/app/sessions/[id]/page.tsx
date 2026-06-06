"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { VerificationRecord } from "@/lib/types";

function Badge({ passed, status }: { passed: boolean | null; status: string }) {
  const base = "mono rounded-md px-2 py-1 text-sm font-semibold";
  if (status === "running") return <span className={`${base} bg-accent/15 text-accent`}>● RUNNING</span>;
  if (status === "error") return <span className={`${base} bg-fail/15 text-fail`}>⚠ ERROR</span>;
  return passed ? (
    <span className={`${base} bg-pass/15 text-pass`}>✓ PASS</span>
  ) : (
    <span className={`${base} bg-fail/15 text-fail`}>✗ FAIL</span>
  );
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<VerificationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setSession(j.session as VerificationRecord);
      })
      .catch((e) => setError(String(e)));
  }, [id]);

  const steps = session?.steps ?? [];

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const t = setTimeout(() => {
      setCursor((c) => {
        if (c >= steps.length - 1) {
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 1100);
    return () => clearTimeout(t);
  }, [playing, cursor, steps.length]);

  if (error)
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="mono text-accent">← back</Link>
        <p className="mono mt-6 text-fail">{error}</p>
      </main>
    );

  if (!session)
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="mono text-muted">Loading session…</p>
      </main>
    );

  const current = steps[cursor];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <Link href="/" className="mono text-sm text-accent hover:underline">
        ← all sessions
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">{session.goal}</h1>
          <a
            href={session.url}
            target="_blank"
            rel="noreferrer"
            className="mono text-sm text-muted hover:text-accent"
          >
            {session.url} ↗
          </a>
        </div>
        <div className="text-right">
          <Badge passed={session.passed} status={session.status} />
          <div className="mono mt-1 text-xs text-muted">
            {steps.length} steps · {session.duration_ms ?? "—"}ms
          </div>
        </div>
      </header>

      {session.summary && (
        <p className="mt-4 rounded-lg border border-border bg-panel px-4 py-3 text-sm">
          {session.summary}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Screenshot viewport */}
        <div className="rounded-xl border border-border bg-panel p-3">
          <div className="mono mb-2 flex items-center gap-2 text-xs text-muted">
            <span className="flex gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-fail" />
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-[#f5c451]" />
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-pass" />
            </span>
            <span className="truncate">{current?.pageUrl ?? session.url}</span>
          </div>
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border bg-background">
            {current?.screenshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.screenshotUrl}
                alt={`step ${cursor}`}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted mono text-sm">
                (no screenshot — check InsForge Storage bucket)
              </div>
            )}
          </div>

          {/* Transport */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              className="mono rounded-md border border-border px-3 py-1 text-sm hover:border-accent"
            >
              ◀
            </button>
            <button
              onClick={() => {
                if (cursor >= steps.length - 1) setCursor(0);
                setPlaying((p) => !p);
              }}
              className="mono rounded-md bg-accent px-4 py-1 text-sm font-semibold text-background"
            >
              {playing ? "❚❚ pause" : "▶ play"}
            </button>
            <button
              onClick={() => setCursor((c) => Math.min(steps.length - 1, c + 1))}
              className="mono rounded-md border border-border px-3 py-1 text-sm hover:border-accent"
            >
              ▶
            </button>
            <span className="mono ml-auto text-xs text-muted">
              step {cursor + 1} / {steps.length}
            </span>
          </div>

          {current && (
            <div className="mt-3 rounded-lg border border-border bg-background p-3">
              <div className="mono text-sm text-accent">{current.action}</div>
              {current.thought && <p className="mt-1 text-sm text-muted">{current.thought}</p>}
              {current.consoleErrors.length > 0 && (
                <ul className="mono mt-2 space-y-0.5 text-xs text-fail">
                  {current.consoleErrors.map((e, i) => (
                    <li key={i} className="truncate">• {e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Step timeline */}
        <div className="rounded-xl border border-border bg-panel p-2">
          <div className="mono px-2 py-1 text-xs uppercase tracking-wider text-muted">
            Timeline
          </div>
          <ol className="max-h-[520px] space-y-1 overflow-y-auto">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setPlaying(false);
                    setCursor(i);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                    i === cursor ? "bg-accent/15 text-foreground" : "text-muted hover:bg-background/60"
                  }`}
                >
                  <span className="mono text-xs text-accent">#{i + 1}</span>{" "}
                  <span className="mono">{s.action}</span>
                  {s.consoleErrors.length > 0 && (
                    <span className="mono ml-1 text-xs text-fail">⚠{s.consoleErrors.length}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
