import { NextRequest, NextResponse } from "next/server";
import { getInsforge } from "@/lib/insforge";

/**
 * Voice-command extraction. The client pre-filters with the TRIGGER regex,
 * then this route runs the LLM extraction over the rolling transcript window
 * via the InsForge AI gateway. Supports six kinds of proposal:
 *   agent | email | linear | slack | notion | attio
 */

const MODELS = (process.env.COMPUTAH_MODEL || "openai/gpt-4o-mini")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const SYSTEM_PROMPT = `You detect whether the speaker is issuing a concrete command. Six command kinds are supported:

- "agent": spin up / launch a background coding agent ("replicant") to build something — including "send Devin to…" / "have Devin build…".
- "email": send an email via Gmail.
- "linear": create a Linear issue / ticket / task.
- "slack": send a Slack message to a person or channel.
- "notion": create a Notion page or note.
- "attio": add / update a record (person, company, deal) in Attio.

You are given a short rolling window of speech transcript. Decide if the latest sentences contain a clear directive to do one of these things NOW (not musing). If not, return isCommand=false.

Return STRICT JSON:
{
  "isCommand": boolean,
  "confidence": 0..1,
  "kind": "agent" | "email" | "linear" | "slack" | "notion" | "attio",
  "name": string,          // short label, max 4 words (e.g. "tetris game", "email Bob re: launch")
  "message": string,       // self-contained, imperative summary of the command
  "codingAgent": "claude" | "codex" | "devin",  // only relevant when kind == "agent"
  "payload": {             // kind-specific structured fields; omit unknown ones
    "to": string,          // email recipient (name or address)
    "subject": string,     // email subject
    "body": string,        // email/slack/notion body or note
    "title": string,       // linear/notion title
    "team": string,        // linear team name
    "channel": string,     // slack channel
    "recordType": string,  // attio: "person" | "company" | "deal"
    "recordName": string   // attio: the entity name
  }
}

Rules:
- Infer reasonable scope from context; do not include filler or meta-talk.
- "message" must read as an imperative ("Build a tetris game…", "Email Bob about the demo…", "Open a Linear issue for the bug…").
- If kind == "agent": codingAgent = "devin" if the speaker names Devin (e.g. "send Devin to…", "have Devin build…"); "codex" only if they explicitly ask for codex; otherwise "claude".
- If kind != "agent", "codingAgent" should be "claude" (ignored downstream).
- If you cannot pin down a kind, return isCommand=false.
- For email: "payload.to" MUST be a valid email address. Speech transcripts spell addresses without the @ ("Nick at mochacare.com" → "nick@mochacare.com"). Convert " at " inside an address into "@" and lowercase the result. If you cannot construct a valid address, set kind to something else or return isCommand=false.
- For email: synthesize "subject" and "body" from context. Keep the subject under 8 words.
- For linear: "title" is short ("Fix login redirect"); "body" is the longer description if any.
- For notion: "title" is the page title; "body" is the markdown content.
- For slack: "channel" is the channel name without "#".
- For attio: "recordType" is one of "person" | "company" | "deal". "recordName" is the entity name.

If it is not a real command, return {"isCommand": false, "confidence": 0, "kind": "agent", "name": "", "message": "", "codingAgent": "claude", "payload": {}}.`;

type Payload = Record<string, string>;
type Detection = {
  isCommand: boolean;
  confidence?: number;
  kind?: string;
  name?: string;
  message?: string;
  codingAgent?: string;
  payload?: Payload;
};

const VALID_KINDS = new Set(["agent", "email", "linear", "slack", "notion", "attio"]);
const VALID_AGENTS = new Set(["claude", "codex", "devin"]);

function normalize(parsed: Record<string, unknown>): Detection {
  const kind = String(parsed.kind || "agent");
  const payload = (parsed.payload && typeof parsed.payload === "object")
    ? (parsed.payload as Payload)
    : {};
  const rawAgent = String(parsed.codingAgent || "claude");
  return {
    isCommand: Boolean(parsed.isCommand) && Boolean(String(parsed.message || "").trim()),
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
    kind: VALID_KINDS.has(kind) ? kind : "agent",
    name: String(parsed.name || "").trim(),
    message: String(parsed.message || "").trim(),
    codingAgent: VALID_AGENTS.has(rawAgent) ? rawAgent : "claude",
    payload,
  };
}

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
        max_tokens: 500,
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
      const det = normalize(parsed);
      if (!det.isCommand) {
        return NextResponse.json({ isCommand: false, confidence: det.confidence });
      }
      return NextResponse.json(det);
    } catch (err) {
      lastErr = err;
    }
  }
  return NextResponse.json(
    { isCommand: false, error: (lastErr as Error)?.message || "all models failed" },
    { status: 502 }
  );
}
