import type { Settings } from "./config";
import { chat, type Memory } from "./insforge";

/**
 * The "understanding" layer (ported from the desktop app). Given a window of
 * transcript, ask the InsForge AI gateway to distill durable memory items.
 */
const SYSTEM_PROMPT = `You distill a live conversation transcript into durable memory items.
Read the transcript excerpt and extract only genuinely useful, self-contained items.
Return STRICT JSON only (no prose, no markdown fences): {"memories":[{"kind","content","tags","sourceExcerpt"}]}.
- kind is one of: note, action_item, question, decision, entity.
- content is a concise, standalone statement (no "the user said"). Rephrase into a clear fact/task.
- tags is a short array of lowercase topic keywords (0-4).
- sourceExcerpt is a short verbatim quote from the transcript that supports it.
Rules: skip filler, greetings, and anything not worth remembering. If nothing is
worth keeping, return {"memories":[]}. Do not invent details not in the transcript.`;

const KINDS = ["note", "action_item", "question", "decision", "entity"] as const;

export async function extractMemories(
  s: Settings,
  transcript: string
): Promise<{ memories: Memory[]; error?: string }> {
  if (!transcript || transcript.trim().length < 20) return { memories: [] };

  let raw = "";
  try {
    raw = await chat(
      s,
      s.understandingModel,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcript excerpt:\n\n${transcript}` },
      ],
      { temperature: 0.2, maxTokens: 800 }
    );
  } catch (err) {
    return { memories: [], error: err instanceof Error ? err.message : String(err) };
  }

  let parsed: { memories?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { memories: [] };
  }

  const list = Array.isArray(parsed.memories) ? parsed.memories : [];
  const memories: Memory[] = list
    .filter((m: unknown): m is Record<string, unknown> => {
      return Boolean(m && typeof (m as Record<string, unknown>).content === "string");
    })
    .map((m) => ({
      kind: (KINDS as readonly string[]).includes(m.kind as string)
        ? (m.kind as Memory["kind"])
        : "note",
      content: String(m.content).trim(),
      tags: Array.isArray(m.tags)
        ? (m.tags as unknown[]).filter((t) => typeof t === "string").slice(0, 4) as string[]
        : [],
      source_excerpt: typeof m.sourceExcerpt === "string" ? m.sourceExcerpt.trim() : null,
    }))
    .filter((m) => m.content.length > 0);

  return { memories };
}

export const SAMPLE_TRANSCRIPT = `So for the InsForge hackathon demo, let's make sure we ship the mobile app by 6pm. Ayush is going to handle the Deepgram transcription piece, and I'll wire up the InsForge backend. We decided to use Limrun to build and preview the iOS app since none of us want to deal with Xcode locally. Oh, remember to grab the Limrun API key from the console before the build. One open question is whether the cloud simulator can access a microphone — we should test that. Also the judges said memory extraction quality matters, so let's use a good model for the understanding layer.`;
