import { NextResponse } from "next/server";
import { getInsforge, insforgeConfigured, VERIFICATIONS_TABLE } from "@/lib/insforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!insforgeConfigured()) {
    return NextResponse.json({ error: "InsForge not configured." }, { status: 500 });
  }
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from(VERIFICATIONS_TABLE)
    .select("*")
    .eq("id", id)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: String(error.message ?? error) }, { status: 500 });
  }
  const session = Array.isArray(data) ? data[0] : data;
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}
