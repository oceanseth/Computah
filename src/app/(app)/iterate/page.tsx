"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardLabel } from "../_components/Card";
import EmptyState from "../_components/EmptyState";
import PageHeader from "../_components/PageHeader";
import { ChatBubbleIcon, InboxIcon, MicIcon } from "../_components/Icons";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useProject } from "@/lib/use-project";

/**
 * Iterate — the project conversation. One feed across web, voice, and every
 * connected platform (Discord/Slack), updating in realtime; what you say here
 * replicates everywhere and drives the agents.
 */

type Message = {
  id: string;
  platform: string;
  channel_id: string;
  author_name: string | null;
  content: string;
  sent_at: string | null;
  created_at: string;
};

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

const PLATFORM_BADGE: Record<string, string> = {
  web: "💬",
  voice: "🎙️",
  discord: "🟣",
  slack: "🟦",
  maskord: "🎭",
};

export default function IteratePage() {
  const { user, project, hub, links, ready } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  const loadMessages = useCallback(async () => {
    if (!hub) return;
    const db = getInsforgeBrowser().database;
    const { data: webRows } = await db
      .from("platform_messages")
      .select()
      .in("platform", ["web", "voice"])
      .eq("channel_id", hub.id)
      .order("created_at", { ascending: true })
      .limit(200);
    let all: Message[] = (webRows as Message[]) ?? [];
    for (const link of links) {
      const { data: bridged } = await db
        .from("platform_messages")
        .select()
        .eq("platform", link.platform)
        .eq("channel_id", link.external_channel_id)
        .order("created_at", { ascending: true })
        .limit(200);
      all = all.concat((bridged as Message[]) ?? []);
    }
    all.sort((a, b) =>
      (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at)
    );
    setMessages(all);
  }, [hub, links]);

  // realtime + slow fallback
  useEffect(() => {
    if (!hub) return;
    const insforge = getInsforgeBrowser();
    const channelName = `hub:${hub.id}`;
    let mounted = true;
    const onNew = (payload: { meta?: { channel?: string } }) => {
      if (payload.meta?.channel !== channelName) return;
      void loadMessages();
    };
    void (async () => {
      try {
        await insforge.realtime.connect();
        const res = await insforge.realtime.subscribe(channelName);
        if (res.ok && mounted) insforge.realtime.on("new_message", onNew);
      } catch {}
    })();
    void loadMessages();
    const t = setInterval(() => void loadMessages(), 15000);
    return () => {
      mounted = false;
      insforge.realtime.off("new_message", onNew);
      insforge.realtime.unsubscribe(channelName);
      clearInterval(t);
    };
  }, [hub, loadMessages]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  async function postMessage(content: string, platform: "web" | "voice") {
    if (!user || !hub || !content.trim()) return;
    await getInsforgeBrowser().database.from("platform_messages").insert([
      {
        platform,
        channel_id: hub.id,
        external_id: crypto.randomUUID(),
        author_id: user.id,
        author_name: user.name || user.email,
        content: content.trim(),
        sent_at: new Date().toISOString(),
      },
    ]);
    void loadMessages();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    await postMessage(text, "web");
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice capture needs Chrome (Web Speech API).");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) void postMessage(result[0].transcript, "voice");
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--shell-text-muted)]">
        loading…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        breadcrumb={`Computah / ${project?.name ?? "…"} / Iterate`}
        title="Iterate"
        subtitle="One conversation across every connected platform — and it drives the agents."
        icon={<ChatBubbleIcon size={18} />}
        action={
          links.length === 0 ? (
            <Link
              href="/connections"
              className="inline-flex items-center rounded-full border-[1.5px] border-[var(--shell-text)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-text)] hover:text-white"
            >
              Connect a channel
            </Link>
          ) : undefined
        }
      />

      <Card className="mt-6 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <CardLabel>/ #general</CardLabel>
          <CardLabel>
            {links.map((l) => PLATFORM_BADGE[l.platform] ?? "🔗").join(" ")}{" "}
            {links.length} connected
          </CardLabel>
        </div>

        <div ref={feedRef} className="mt-4 flex-1 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <EmptyState
              icon={<InboxIcon size={64} />}
              title="No messages yet"
              description="Say something below, speak with the mic, or post in a connected channel."
            />
          ) : (
            messages.map((m) => (
              <div key={m.id} className="mb-3.5">
                <div className="text-[11px] text-[var(--shell-text-soft)]">
                  {PLATFORM_BADGE[m.platform] ?? "💬"}{" "}
                  <span className="font-medium text-[var(--shell-text-muted)]">
                    {m.author_name ?? "unknown"}
                  </span>{" "}
                  · {new Date(m.sent_at ?? m.created_at).toLocaleTimeString()}
                </div>
                <div className="mt-0.5 text-[14px] leading-relaxed text-[var(--shell-text)]">
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="mt-4 flex items-center gap-2 border-t border-[var(--shell-border)] pt-4">
          <button
            type="button"
            onClick={toggleVoice}
            title="Toggle voice capture"
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
              listening
                ? "border-[var(--shell-coral)] bg-[var(--shell-peach)] text-[var(--shell-coral)]"
                : "border-[var(--shell-border)] text-[var(--shell-text-muted)] hover:border-[var(--shell-coral)] hover:text-[var(--shell-coral)]"
            }`}
          >
            <MicIcon size={16} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message #general — replicates to every connected channel"
            className="flex-1 rounded-full border border-[var(--shell-border)] bg-white px-5 py-2.5 text-[14px] text-[var(--shell-text)] outline-none focus:border-[var(--shell-coral)]"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-[var(--shell-text)] px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--shell-coral)] disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </Card>
    </div>
  );
}
