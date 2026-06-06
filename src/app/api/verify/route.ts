import { NextResponse } from "next/server";
import { runVerification } from "@/lib/verify";
import { insforgeConfigured } from "@/lib/insforge";
import type { VerifyRequest } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!insforgeConfigured()) {
    return NextResponse.json(
      { error: "InsForge not configured. Set INSFORGE_BASE_URL and INSFORGE_API_KEY." },
      { status: 500 }
    );
  }

  let body: VerifyRequest;
  try {
    body = (await request.json()) as VerifyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.url || !body?.goal) {
    return NextResponse.json(
      { error: "Both `url` and `goal` are required." },
      { status: 400 }
    );
  }

  try {
    new URL(body.url);
  } catch {
    return NextResponse.json({ error: "`url` is not a valid URL." }, { status: 400 });
  }

  try {
    const record = await runVerification(body);
    return NextResponse.json(record);
  } catch (err) {
    return NextResponse.json(
      { error: `Verification failed: ${String(err)}` },
      { status: 500 }
    );
  }
}
