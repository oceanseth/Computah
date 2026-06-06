"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useAuth } from "@/lib/auth-context";

/**
 * The voice-app, on the web: an always-listening transcription session.
 * Same data model as the Electron app — a `sessions` row per run, finalized
 * utterances as `transcript_segments` — so desktop and web feed one store.
 */

type Session = {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
};
type Segment = { id: string; session_id: string; text: string; created_at: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export default function VoicePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepAliveRef = useRef(false);

  const loadSessions = useCallback(async () => {
    const db = getInsforgeBrowser().database;
    const { data } = await db
      .from("sessions")
      .select()
      .order("started_at", { ascending: false })
      .limit(25);
    setSessions((data as Session[]) ?? []);
  }, []);

  const loadSegments = useCallback(async (sessionId: string) => {
    const db = getInsforgeBrowser().database;
    const { data } = await db
      .from("transcript_segments")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(500);
    setSegments((data as Segment[]) ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void loadSessions();
  }, [loading, user, router, loadSessions]);

  async function startListening() {
    if (!user) return;
    const Ctor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice capture needs Chrome (Web Speech API).");
      return;
    }
    const db = getInsforgeBrowser().database;
    const { data: created } = await db
      .from("sessions")
      .insert([
        {
          title: `Web session — ${new Date().toLocaleString()}`,
          user_id: user.id,
        },
      ])
      .select();
    const session = (created as Session[] | null)?.[0];
    if (!session) return;
    setActiveSession(session);
    setSegments([]);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          void db
            .from("transcript_segments")
            .insert([{ session_id: session.id, text: text.trim(), is_final: true }])
            .then(() => loadSegments(session.id));
        } else {
          interimText += text;
        }
      }
      setInterim(interimText);
    };
    // Chrome stops recognition after silence — restart while session is live
    rec.onend = () => {
      if (keepAliveRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };
    recognitionRef.current = rec;
    keepAliveRef.current = true;
    rec.start();
    setListening(true);
  }

  async function stopListening() {
    keepAliveRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
    if (activeSession) {
      const db = getInsforgeBrowser().database;
      await db
        .from("sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("id", activeSession.id);
      void loadSessions();
    }
  }

  async function openSession(s: Session) {
    setActiveSession(s);
    await loadSegments(s.id);
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">loading…</main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/app" className="mono text-sm text-muted hover:text-foreground">
            ← projects
          </Link>
          <span className="font-semibold">Voice</span>
        </div>
        <span className="mono text-xs text-muted">{user.email}</span>
      </header>

      <div className="mb-8 flex items-center gap-4 rounded-2xl border border-border bg-panel p-6">
        <button
          onClick={() => (listening ? void stopListening() : void startListening())}
          className={`rounded-xl px-6 py-3 text-sm font-semibold transition ${
            listening
              ? "border border-accent bg-accent/10 text-accent"
              : "bg-accent text-background hover:opacity-90"
          }`}
        >
          {listening ? "■ Stop listening" : "🎙️ Start listening"}
        </button>
        <div className="min-w-0 flex-1">
          {listening ? (
            <p className="truncate text-sm text-muted">
              {interim || "Listening… speak and finalized utterances are saved."}
            </p>
          ) : (
            <p className="text-sm text-muted">
              Always-listening transcription, in the browser — same store as the desktop
              voice app (`sessions` + `transcript_segments`).
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside>
          <div className="mono mb-2 text-xs uppercase tracking-wide text-muted">sessions</div>
          <div className="flex flex-col gap-1.5">
            {sessions.length === 0 && (
              <p className="text-sm text-muted">No sessions yet.</p>
            )}
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => void openSession(s)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  activeSession?.id === s.id
                    ? "border-accent bg-panel text-foreground"
                    : "border-border bg-panel/50 text-muted hover:text-foreground"
                }`}
              >
                <div className="truncate">{s.title ?? "untitled"}</div>
                <div className="mono mt-0.5 text-xs opacity-70">
                  {new Date(s.started_at).toLocaleString()}
                  {!s.ended_at && " · live"}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="rounded-2xl border border-border bg-panel/40 p-6">
          <div className="mono mb-3 text-xs uppercase tracking-wide text-muted">transcript</div>
          {segments.length === 0 ? (
            <p className="text-sm text-muted">
              {activeSession ? "Nothing transcribed yet." : "Pick a session or start listening."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {segments.map((seg) => (
                <div key={seg.id} className="text-sm">
                  <span className="mono mr-2 text-xs text-muted">
                    {new Date(seg.created_at).toLocaleTimeString()}
                  </span>
                  {seg.text}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
