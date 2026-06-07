"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardLabel } from "../_components/Card";
import EmptyState from "../_components/EmptyState";
import PageHeader from "../_components/PageHeader";
import { HeadphonesIcon, InboxIcon, MicIcon, PlugIcon } from "../_components/Icons";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useProject } from "@/lib/use-project";

/**
 * Listen — the desktop voice-app's loop, on the web:
 * always-listening transcription → every utterance replicates to the project's
 * connected channels → spoken "spin up an agent to …" commands become proposed
 * replicant cards → approve to launch a cloud coding agent.
 */

type Replicant = {
  id: string;
  name: string;
  message: string;
  coding_agent: string;
  status: string;
  url: string | null;
  created_at: string;
};
type TranscriptLine = { at: string; text: string };

// Fast local gate (from desktop commands.js) so we don't call the LLM on
// every segment.
const TRIGGER =
  /\b(replica|replicas|replicant|devin)\b|\b(spin up|spin off|fire up|kick off|kick (it )?off|start|launch|stand up|send|have)\b[^.?!]{0,40}\b(agent|devin)\b/i;

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

const STATUS_STYLE: Record<string, string> = {
  proposed: "bg-[var(--shell-peach)] text-[var(--shell-coral)]",
  spawning: "bg-amber-100 text-amber-700",
  running: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-600",
  rejected: "bg-[#f1efeb] text-[var(--shell-text-soft)]",
};

export default function ListenPage() {
  const { user, loading, project, hub, links, refresh } = useProject();
  const [discordId, setDiscordId] = useState("");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [replicants, setReplicants] = useState<Replicant[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const keepAliveRef = useRef(false);
  const windowRef = useRef<string[]>([]); // rolling transcript window
  const detectBusyRef = useRef(false);

  const loadReplicants = useCallback(async () => {
    if (!project || !user) return;
    try {
      const res = await fetch(
        `/api/replicants?projectId=${project.id}&userId=${user.id}`
      );
      if (res.ok) {
        const { replicants } = (await res.json()) as { replicants: Replicant[] };
        setReplicants(replicants ?? []);
      }
    } catch {}
  }, [project, user]);

  useEffect(() => {
    if (!project) return;
    void loadReplicants();
    const t = setInterval(() => void loadReplicants(), 5000);
    return () => clearInterval(t);
  }, [project, loadReplicants]);

  // ---- voice ----
  async function postVoiceMessage(text: string) {
    if (!user || !hub) return;
    await getInsforgeBrowser().database.from("platform_messages").insert([
      {
        platform: "voice",
        channel_id: hub.id,
        external_id: crypto.randomUUID(),
        author_id: user.id,
        author_name: user.name || user.email,
        content: text,
        sent_at: new Date().toISOString(),
      },
    ]);
  }

  async function maybeDetectCommand() {
    const windowText = windowRef.current.join(" ");
    if (!TRIGGER.test(windowText) || detectBusyRef.current || !project || !user) return;
    detectBusyRef.current = true;
    try {
      const res = await fetch("/api/detect-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: windowText }),
      });
      const det = (await res.json()) as {
        isCommand?: boolean;
        confidence?: number;
        name?: string;
        message?: string;
        codingAgent?: string;
      };
      if (det.isCommand && (det.confidence ?? 0) >= 0.5 && det.message) {
        windowRef.current = []; // don't re-trigger on the same utterances
        await getInsforgeBrowser().database.from("replicants").insert([
          {
            project_id: project.id,
            name: det.name || det.message.slice(0, 40),
            message: det.message,
            coding_agent:
              det.codingAgent === "devin"
                ? "devin"
                : det.codingAgent === "codex"
                  ? "codex"
                  : "claude",
            status: "proposed",
            created_by: user.id,
          },
        ]);
        void loadReplicants();
      }
    } catch {
    } finally {
      detectBusyRef.current = false;
    }
  }

  function startListening() {
    const Ctor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition;
    if (!Ctor) {
      setNotice("Voice capture needs Chrome (Web Speech API).");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (result.isFinal && text) {
          setLines((prev) => [...prev, { at: new Date().toISOString(), text }]);
          windowRef.current = [...windowRef.current.slice(-5), text];
          void postVoiceMessage(text);
          void maybeDetectCommand();
        } else {
          interimText += result[0].transcript;
        }
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      if (keepAliveRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    recognitionRef.current = rec;
    keepAliveRef.current = true;
    rec.start();
    setListening(true);
    setNotice(null);
  }

  function stopListening() {
    keepAliveRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  }

  // ---- replicant actions ----
  async function approve(r: Replicant) {
    if (!user) return;
    setBusyId(r.id);
    setNotice(null);
    const res = await fetch("/api/replicants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, userId: user.id }),
    });
    if (!res.ok) {
      const { error } = (await res.json()) as { error?: string };
      setNotice(error || "spawn failed");
    }
    setBusyId(null);
    void loadReplicants();
  }

  async function reject(r: Replicant) {
    await getInsforgeBrowser()
      .database.from("replicants")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", r.id);
    void loadReplicants();
  }

  async function nudge(r: Replicant) {
    if (!user) return;
    const text = window.prompt(
      "Message for the agent (what changed / what to retry):",
      "The blocking issue has been fixed — please retry and continue."
    );
    if (text === null) return;
    setBusyId(r.id);
    const res = await fetch("/api/replicants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, userId: user.id, action: "nudge", message: text }),
    });
    if (!res.ok) {
      const { error } = (await res.json()) as { error?: string };
      setNotice(error || "nudge failed");
    }
    setBusyId(null);
    void loadReplicants();
  }

  async function connectDiscord(e: React.FormEvent) {
    e.preventDefault();
    if (!hub || !user || !discordId.trim()) return;
    await getInsforgeBrowser().database.from("channel_links").insert([
      {
        channel_id: hub.id,
        platform: "discord",
        external_channel_id: discordId.trim(),
        created_by: user.id,
      },
    ]);
    setDiscordId("");
    void refresh();
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--shell-text-muted)]">
        loading…
      </div>
    );
  }

  const discordLinks = links.filter((l) => l.platform === "discord");
  const pending = replicants.filter((r) => r.status === "proposed");

  return (
    <div>
      <PageHeader
        breadcrumb={`Computah / ${project?.name ?? "…"} / Listen`}
        title="Listen"
        subtitle="Computah hears every word. It only acts when you ask."
        icon={<MicIcon size={18} />}
        action={
          <button
            type="button"
            onClick={() => (listening ? stopListening() : startListening())}
            className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
              listening
                ? "border-[var(--shell-coral)] bg-[var(--shell-coral)] text-white"
                : "border-[var(--shell-text)] text-[var(--shell-text)] hover:bg-[var(--shell-text)] hover:text-white"
            }`}
          >
            <MicIcon size={14} />
            {listening ? "Stop Listening" : "Start Listening"}
          </button>
        }
      />

      {/* discord connection strip */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <CardLabel>/ Channel Sources</CardLabel>
        {discordLinks.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--shell-peach)] px-3 py-1 text-[11px] font-medium text-[var(--shell-coral)]"
          >
            <PlugIcon size={12} /> discord · {l.external_channel_id}
          </span>
        ))}
        <form onSubmit={connectDiscord} className="flex items-center gap-2">
          <input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="discord channel id"
            className="rounded-full border border-[var(--shell-border)] bg-white px-4 py-1.5 text-[12px] text-[var(--shell-text)] outline-none focus:border-[var(--shell-coral)]"
          />
          <button
            type="submit"
            disabled={!discordId.trim()}
            className="rounded-full border border-[var(--shell-border)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-text-muted)] transition hover:border-[var(--shell-coral)] hover:text-[var(--shell-coral)] disabled:opacity-40"
          >
            Connect
          </button>
        </form>
      </div>

      {notice && (
        <p className="mt-3 text-[13px] text-[var(--shell-coral)]">{notice}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* live transcript */}
        <Card className="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between">
            <CardLabel>/ Live Transcript</CardLabel>
            {listening && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-coral)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--shell-coral)]" />
                Live
              </span>
            )}
          </div>
          {lines.length === 0 && !listening ? (
            <EmptyState
              icon={<HeadphonesIcon size={64} />}
              title="Not listening"
              description="Click Start Listening to begin transcription. Every utterance replicates to your connected channels."
            />
          ) : (
            <div className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto">
              {lines.map((l, i) => (
                <div key={i} className="text-[14px] leading-relaxed text-[var(--shell-text)]">
                  <span className="mr-2 text-[11px] tabular-nums text-[var(--shell-text-soft)]">
                    {new Date(l.at).toLocaleTimeString()}
                  </span>
                  {l.text}
                </div>
              ))}
              {interim && (
                <div className="text-[14px] italic text-[var(--shell-text-soft)]">{interim}…</div>
              )}
              {listening && lines.length === 0 && !interim && (
                <div className="text-[13px] text-[var(--shell-text-muted)]">
                  Listening… try &ldquo;spin up an agent to build a tetris game.&rdquo;
                </div>
              )}
            </div>
          )}
        </Card>

        {/* proposed actions / replicants */}
        <Card className="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between">
            <CardLabel>/ Replicants</CardLabel>
            <CardLabel>
              {pending.length} pending · {replicants.length} total
            </CardLabel>
          </div>
          {replicants.length === 0 ? (
            <EmptyState
              icon={<InboxIcon size={64} />}
              title="Nothing pending"
              description='Say "spin up an agent to build…" and a card will appear here.'
            />
          ) : (
            <div className="mt-5 flex flex-1 flex-col gap-3 overflow-y-auto">
              {replicants.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-[var(--shell-border)] bg-[var(--shell-bg)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-medium text-[var(--shell-text)]">
                      {r.name}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        STATUS_STYLE[r.status] ?? "bg-[#f1efeb] text-[var(--shell-text-muted)]"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--shell-text-muted)]">
                    {r.message}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--shell-text-soft)]">
                      {r.coding_agent}
                    </span>
                    <span className="flex-1" />
                    {r.status === "proposed" && (
                      <>
                        <button
                          onClick={() => void reject(r)}
                          className="rounded-full border border-[var(--shell-border)] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-text-muted)] transition hover:text-[var(--shell-text)]"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => void approve(r)}
                          disabled={busyId === r.id}
                          className="rounded-full bg-[var(--shell-text)] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[var(--shell-coral)] disabled:opacity-50"
                        >
                          {busyId === r.id ? "Spawning…" : "Approve"}
                        </button>
                      </>
                    )}
                    {r.status !== "proposed" &&
                      r.status !== "rejected" &&
                      r.coding_agent !== "devin" && (
                        <button
                          onClick={() => void nudge(r)}
                          disabled={busyId === r.id}
                          title="Send a follow-up message to the agent (e.g. after fixing a secret)"
                          className="rounded-full border border-[var(--shell-border)] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-text-muted)] transition hover:border-[var(--shell-coral)] hover:text-[var(--shell-coral)] disabled:opacity-50"
                        >
                          {busyId === r.id ? "Nudging…" : "Nudge"}
                        </button>
                      )}
                    {r.url && r.status !== "proposed" && r.status !== "rejected" && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-coral)] hover:underline"
                      >
                        Dashboard ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
