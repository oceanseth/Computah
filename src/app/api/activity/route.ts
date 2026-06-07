import { NextResponse } from "next/server";
import { getInsforge, insforgeConfigured } from "@/lib/insforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  platform: string;
  channel_id: string;
  author_name: string | null;
  content: string;
  sent_at: string | null;
  created_at: string;
};

type VerificationRow = {
  id: string;
  url: string;
  goal: string;
  status: string;
  passed: boolean | null;
  created_at: string;
};

export async function GET() {
  if (!insforgeConfigured()) {
    return NextResponse.json({ items: [] });
  }

  const insforge = getInsforge();

  const [messagesResult, runsResult] = await Promise.all([
    insforge.database
      .from("platform_messages")
      .select("id,platform,channel_id,author_name,content,sent_at,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    insforge.database
      .from("verifications")
      .select("id,url,goal,status,passed,created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (messagesResult.error) {
    return NextResponse.json(
      { error: String(messagesResult.error.message ?? messagesResult.error) },
      { status: 500 }
    );
  }
  if (runsResult.error) {
    return NextResponse.json(
      { error: String(runsResult.error.message ?? runsResult.error) },
      { status: 500 }
    );
  }

  const messages = ((messagesResult.data ?? []) as MessageRow[]).map((m) => ({
    kind: "message" as const,
    id: m.id,
    platform: m.platform,
    author_name: m.author_name,
    content: m.content,
    created_at: m.sent_at ?? m.created_at,
  }));

  const runs = ((runsResult.data ?? []) as VerificationRow[]).map((r) => ({
    kind: "run" as const,
    id: r.id,
    url: r.url,
    goal: r.goal,
    status: r.status,
    passed: r.passed,
    created_at: r.created_at,
  }));

  const items = [...messages, ...runs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);

  return NextResponse.json({ items });
}
