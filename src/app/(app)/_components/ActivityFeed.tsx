"use client";

import { useEffect, useRef, useState } from "react";
import EmptyState from "./EmptyState";
import { ActivityIcon, ChatBubbleIcon, DiscordIcon, MicIcon, SparkleIcon } from "./Icons";

type MessageItem = {
  kind: "message";
  id: string;
  platform: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

type RunItem = {
  kind: "run";
  id: string;
  url: string;
  goal: string;
  status: string;
  passed: boolean | null;
  created_at: string;
};

type ActivityItem = MessageItem | RunItem;

function ago(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "discord") {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: "#eef0fd", color: "#5865F2" }}
      >
        <DiscordIcon size={16} />
      </span>
    );
  }
  if (platform === "slack") {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: "#f3eaf3", color: "#4A154B" }}
      >
        <ChatBubbleIcon size={14} />
      </span>
    );
  }
  if (platform === "voice") {
    return (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: "#fde6d8", color: "var(--shell-coral)" }}
      >
        <MicIcon size={14} />
      </span>
    );
  }
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
      style={{ background: "#f1efeb", color: "var(--shell-text-muted)" }}
    >
      <ChatBubbleIcon size={14} />
    </span>
  );
}

function RunBadge() {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
      style={{ background: "#f1efeb", color: "var(--shell-text)" }}
    >
      <SparkleIcon size={14} />
    </span>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col divide-y divide-[var(--shell-border)]">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3 py-3.5 animate-pulse">
          <div className="h-8 w-8 shrink-0 rounded-md bg-[var(--shell-border)]" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3 w-1/4 rounded bg-[var(--shell-border)]" />
            <div className="h-3 w-3/4 rounded bg-[var(--shell-border)]" />
          </div>
          <div className="h-3 w-12 shrink-0 rounded bg-[var(--shell-border)]" />
        </div>
      ))}
    </div>
  );
}

function MessageRow({ item }: { item: MessageItem }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <PlatformBadge platform={item.platform} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold capitalize text-[var(--shell-text)]">
            {item.platform}
          </span>
          {item.author_name && (
            <span className="text-[12px] text-[var(--shell-text-muted)]">
              · {item.author_name}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-[var(--shell-text-muted)]">
          {item.content}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--shell-text-soft)]">
        {ago(item.created_at)}
      </span>
    </div>
  );
}

function RunRow({ item }: { item: RunItem }) {
  let hostname = item.url;
  try {
    hostname = new URL(item.url).hostname;
  } catch {}

  return (
    <div className="flex items-start gap-3 py-3.5">
      <RunBadge />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--shell-text)]">
            Agent run
          </span>
          <span className="text-[12px] text-[var(--shell-text-muted)]">· {hostname}</span>
          {item.passed !== null && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={
                item.passed
                  ? { background: "#d1fae5", color: "#065f46" }
                  : { background: "#fee2e2", color: "#991b1b" }
              }
            >
              {item.passed ? "pass" : "fail"}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-[var(--shell-text-muted)]">
          {item.goal}
        </p>
      </div>
      <span className="shrink-0 text-[11px] text-[var(--shell-text-soft)]">
        {ago(item.created_at)}
      </span>
    </div>
  );
}

export default function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/activity");
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items ?? []);
      setDemo(json.demo ?? false);
    } catch {}
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    intervalRef.current = setInterval(load, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (loading) return <SkeletonRows />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ActivityIcon size={56} />}
        title="Nothing yet"
        description="When agents run or messages arrive, they'll show up here."
      />
    );
  }

  return (
    <div>
      {demo && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--shell-border)] bg-[var(--shell-bg)] px-3 py-2 text-[11px] text-[var(--shell-text-soft)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--shell-text-soft)]" />
          Demo data — connect Discord or run a verification to see live activity
        </div>
      )}
      <div className="flex flex-col divide-y divide-[var(--shell-border)]">
        {items.map((item) =>
          item.kind === "message" ? (
            <MessageRow key={item.id} item={item} />
          ) : (
            <RunRow key={item.id} item={item} />
          )
        )}
      </div>
    </div>
  );
}
