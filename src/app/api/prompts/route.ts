import { NextResponse } from "next/server";
import { insforgeConfigured, getInsforge } from "@/lib/insforge";
import type { PromptEditRequest } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/prompts?sessionId=<id>&step=<idx>
// Retrieve pending prompts for review
export async function GET(request: Request) {
  if (!insforgeConfigured()) {
    return NextResponse.json(
      { error: "InsForge not configured." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const step = searchParams.get("step") || "0";

  if (!sessionId) {
    return NextResponse.json(
      { error: "`sessionId` is required." },
      { status: 400 }
    );
  }

  try {
    const insforge = getInsforge();
    const { data, error } = await insforge.database
      .from("prompt_reviews")
      .select("*")
      .eq("verification_id", sessionId)
      .eq("step_idx", parseInt(step))
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Prompts not found for this session/step" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      sessionId,
      stepIdx: data.step_idx,
      systemPrompt: data.system_prompt,
      userPrompt: data.user_prompt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to retrieve prompts: ${String(err)}` },
      { status: 500 }
    );
  }
}

// PUT /api/prompts
// Submit edited prompts and continue verification
export async function PUT(request: Request) {
  if (!insforgeConfigured()) {
    return NextResponse.json(
      { error: "InsForge not configured." },
      { status: 500 }
    );
  }

  let body: PromptEditRequest;
  try {
    body = (await request.json()) as PromptEditRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.sessionId || !body?.systemPrompt || !body?.userPrompt) {
    return NextResponse.json(
      { error: "`sessionId`, `systemPrompt`, and `userPrompt` are required." },
      { status: 400 }
    );
  }

  try {
    const insforge = getInsforge();

    // Mark the prompt as edited
    await insforge.database
      .from("prompt_reviews")
      .update({ edited_at: new Date().toISOString() })
      .eq("verification_id", body.sessionId)
      .eq("step_idx", body.stepIdx);

    // Return confirmation with edited prompts
    return NextResponse.json({
      message: "Prompts updated. Use /api/verify to resume with edited prompts.",
      sessionId: body.sessionId,
      stepIdx: body.stepIdx,
      customSystemPrompt: body.systemPrompt,
      customUserPrompt: body.userPrompt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to update prompts: ${String(err)}` },
      { status: 500 }
    );
  }
}
