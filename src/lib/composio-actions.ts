import { getComposio } from "./composio";

/**
 * Map a proposal card (kind + payload) into a Composio tools.execute() call.
 * Only Gmail is wired end-to-end right now — Linear/Slack/Notion/Attio need
 * workspace-specific IDs (team_id, channel_id, parent_id) that aren't yet
 * captured in project settings, so they return a structured error so the UI
 * can surface what's missing.
 */

export type Payload = {
  to?: string;
  subject?: string;
  body?: string;
  title?: string;
  team?: string;
  channel?: string;
  recordType?: string;
  recordName?: string;
};

export type ExecuteResult = {
  ok: boolean;
  message: string;
  data?: unknown;
  error?: string;
};

// "Nick at mochacare.com" → "nick@mochacare.com"; "nick@mochacare.com" → unchanged.
function coerceEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return v;
  const m = v.match(/^([A-Za-z][\w.\-]*)\s+at\s+([A-Za-z0-9.\-]+(?:\.[A-Za-z]{2,}))$/i);
  if (m) return `${m[1]}@${m[2]}`.toLowerCase();
  return null;
}

export async function executeProposal(
  userId: string,
  kind: string,
  payload: Payload
): Promise<ExecuteResult> {
  const composio = getComposio();
  switch (kind) {
    case "email": {
      const to = coerceEmail(payload.to);
      if (!to) {
        return {
          ok: false,
          message: `Could not parse a valid email address from "${payload.to ?? ""}"`,
        };
      }
      const subject = payload.subject?.trim() || "(no subject)";
      const body = payload.body?.trim() || "(empty body)";
      const res = await composio.tools.execute("GMAIL_SEND_EMAIL", {
        userId,
        // "latest" version is rejected unless we opt in; for a demo we want
        // the newest schema without pinning a date.
        dangerouslySkipVersionCheck: true,
        arguments: {
          recipient_email: to,
          subject,
          body,
        },
      });
      return {
        ok: Boolean(res.successful),
        message: res.successful
          ? `Email sent to ${to}.`
          : (res.error as string) || "Composio reported the send failed",
        data: res.data,
        error: res.successful ? undefined : (res.error as string | undefined),
      };
    }
    case "linear":
      return {
        ok: false,
        message:
          "Linear approve isn't wired yet — needs a default team_id in project settings. (LLM gave team \"" +
          (payload.team ?? "?") +
          "\".)",
      };
    case "slack":
      return {
        ok: false,
        message:
          "Slack approve isn't wired yet — needs a channel ID (LLM gave \"" +
          (payload.channel ?? "?") +
          "\").",
      };
    case "notion":
      return {
        ok: false,
        message:
          "Notion approve isn't wired yet — needs a default parent page id in project settings.",
      };
    case "attio":
      return {
        ok: false,
        message:
          "Attio approve isn't wired yet — only person/company/deal record types are supported and need workspace mapping.",
      };
    default:
      return { ok: false, message: `Unknown proposal kind "${kind}".` };
  }
}
