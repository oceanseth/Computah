import { NextResponse } from "next/server";
import { getInsforge, insforgeConfigured, VERIFICATIONS_TABLE } from "@/lib/insforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!insforgeConfigured()) {
    return NextResponse.json({ sessions: [] });
  }
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(VERIFICATIONS_TABLE)
    .select("id,url,goal,status,passed,reason,duration_ms,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: String(error.message ?? error) }, { status: 500 });
  }
  return NextResponse.json({ sessions: data ?? [] });
}
