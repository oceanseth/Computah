import { NextRequest, NextResponse } from "next/server";
import { getInsforge } from "@/lib/insforge";

/**
 * Voice-command extraction — port of voice-app/desktop-app/src/main/commands.js.
 * The client pre-filters with the TRIGGER regex; this route runs the LLM
 * extraction over the rolling transcript window via the InsForge AI gateway.
 */

const MODELS = (process.env.COMPUTAH_MODEL || "openai/gpt-4o-mini")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = `You detect whether the speaker is issuing a command to spin up a background coding agent ("replicant") to build or work on something.

You are given a short rolling window of speech transcript. The latest sentence may contain the trigger. Decide if the speaker is actually instructing that an agent be started NOW (not merely musing about agents in general).

Return STRICT JSON:
{"isCommand": boolean, "confidence": 0..1, "name": string, "message": string, "codingAgent": "claude"|"codex"}

- isCommand: true only if there is a clear directive to spin up / start / launch an agent to build/do something.
- message: a clear, self-contained build instruction for the coding agent, written as an imperative (e.g. "Build a Tetris game in React with keyboard controls and a score counter."). Infer reasonable scope from context; do NOT include filler or meta-talk about agents.
- name: a short descriptive label, max 4 words (e.g. "tetris game").
- codingAgent: "claude" unless the speaker explicitly asks for codex.
If it is not a real command, return {"isCommand": false, "confidence": 0, "name": "", "message": "", "codingAgent": "claude"}.`;

export async function POST(req: NextRequest) {
  const { window } = (await req.json()) as { window?: string };
  if (!window?.trim()) {
    return NextResponse.json({ isCommand: false, error: "empty window" }, { status: 400 });
  }

  const insforge = getInsforge();
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res: any = await insforge.ai.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Transcript window:\n\n${window}` },
        ] as never,
      } as never);
      const raw: string = res?.choices?.[0]?.message?.content || "{}";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : { isCommand: false };
      }
      if (!parsed.isCommand || !String(parsed.message || "").trim()) {
        return NextResponse.json({ isCommand: false, confidence: parsed.confidence ?? 0 });
      }
      return NextResponse.json({
        isCommand: true,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
        name: String(parsed.name || "").trim(),
        message: String(parsed.message).trim(),
        codingAgent: parsed.codingAgent === "codex" ? "codex" : "claude",
      });
    } catch (err) {
      lastErr = err;
    }
  }
  return NextResponse.json(
    { isCommand: false, error: (lastErr as Error)?.message || "all models failed" },
    { status: 502 }
  );
}
