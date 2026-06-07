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

function demoItems() {
  const now = Date.now();
  const min = 60_000;
  return [
    { kind: "run" as const, id: "demo-1", url: "https://computah-mu.vercel.app/login", goal: "Log in with test@test.com / password and land on /dashboard", status: "passed", passed: true, created_at: new Date(now - 2 * min).toISOString() },
    { kind: "message" as const, id: "demo-2", platform: "discord", author_name: "seth", content: "hey can you fix the sign-in button — it does nothing on mobile", created_at: new Date(now - 5 * min).toISOString() },
    { kind: "run" as const, id: "demo-3", url: "https://computah-mu.vercel.app/login", goal: "Click sign in with wrong credentials and confirm an error appears", status: "passed", passed: true, created_at: new Date(now - 9 * min).toISOString() },
    { kind: "message" as const, id: "demo-4", platform: "voice", author_name: "abir", content: "build a dashboard that shows all the recent verification runs with pass/fail badges", created_at: new Date(now - 14 * min).toISOString() },
    { kind: "run" as const, id: "demo-5", url: "https://computah-mu.vercel.app", goal: "Home page loads and shows the product description with no console errors", status: "passed", passed: true, created_at: new Date(now - 22 * min).toISOString() },
    { kind: "message" as const, id: "demo-6", platform: "slack", author_name: "pranav", content: "the verification engine is timing out on SPAs — networkidle waits too long", created_at: new Date(now - 31 * min).toISOString() },
    { kind: "run" as const, id: "demo-7", url: "https://the-internet.herokuapp.com/login", goal: "Log in with username tomsmith and password SuperSecretPassword! and confirm success", status: "failed", passed: false, created_at: new Date(now - 47 * min).toISOString() },
    { kind: "message" as const, id: "demo-8", platform: "discord", author_name: "abhishek", content: "Composio Discord trigger is live — messages are landing in platform_messages ✅", created_at: new Date(now - 58 * min).toISOString() },
  ];
}

export async function GET() {
  if (!insforgeConfigured()) {
    return NextResponse.json({ items: demoItems(), demo: true });
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

  if (items.length === 0) {
    return NextResponse.json({ items: demoItems(), demo: true });
  }

  return NextResponse.json({ items });
}
