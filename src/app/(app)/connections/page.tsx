"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardLabel } from "../_components/Card";
import PageHeader from "../_components/PageHeader";
import { DiscordIcon, PlugIcon } from "../_components/Icons";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useProject } from "@/lib/use-project";

/**
 * Connections — channel sources (Discord/Slack/Maskord links on the project's
 * hub channel) and the project's integration settings (bot token, Deepgram,
 * Replicas). Settings are owner-only via RLS.
 */

const inputCls =
  "rounded-md border border-[var(--shell-border)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--shell-text)] outline-none focus:border-[var(--shell-coral)]";
const labelCls =
  "text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--shell-text-muted)]";

export default function ConnectionsPage() {
  const { user, project, hub, links, ready, error: backendError, refresh } = useProject();
  const [platform, setPlatform] = useState("discord");
  const [externalId, setExternalId] = useState("");
  const [botToken, setBotToken] = useState("");
  const [deepgramKey, setDeepgramKey] = useState("");
  const [replicasKey, setReplicasKey] = useState("");
  const [replicasEnv, setReplicasEnv] = useState("");
  const [devinKey, setDevinKey] = useState("");
  const [limKey, setLimKey] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner = Boolean(user && project && project.owner_id === user.id);

  const loadSettings = useCallback(async () => {
    if (!project) return;
    const db = getInsforgeBrowser().database;
    const { data } = await db
      .from("project_settings")
      .select()
      .eq("project_id", project.id);
    const row = (data as Array<Record<string, string | null>> | null)?.[0];
    setSaved({
      bot: Boolean(row?.discord_bot_token),
      deepgram: Boolean(row?.deepgram_api_key),
      replicasKey: Boolean(row?.replicas_api_key),
      replicasEnv: Boolean(row?.replicas_environment_id),
      devin: Boolean(row?.devin_api_key),
      lim: Boolean(row?.lim_api_key),
      verifyUrl: Boolean(row?.verify_url),
    });
  }, [project]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!hub || !user || !externalId.trim()) return;
    const { error } = await getInsforgeBrowser()
      .database.from("channel_links")
      .insert([
        {
          channel_id: hub.id,
          platform,
          external_channel_id: externalId.trim(),
          created_by: user.id,
        },
      ]);
    setMsg(error ? error.message : null);
    setExternalId("");
    void refresh();
  }

  async function disconnect(linkId: string) {
    await getInsforgeBrowser().database.from("channel_links").delete().eq("id", linkId);
    void refresh();
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    const patch: Record<string, string> = {};
    if (botToken.trim()) patch.discord_bot_token = botToken.trim();
    if (deepgramKey.trim()) patch.deepgram_api_key = deepgramKey.trim();
    if (replicasKey.trim()) patch.replicas_api_key = replicasKey.trim();
    if (replicasEnv.trim()) patch.replicas_environment_id = replicasEnv.trim();
    if (devinKey.trim()) patch.devin_api_key = devinKey.trim();
    if (limKey.trim()) patch.lim_api_key = limKey.trim();
    if (verifyUrl.trim()) patch.verify_url = verifyUrl.trim();
    if (Object.keys(patch).length === 0) return;
    const db = getInsforgeBrowser().database;
    const { data: existing } = await db
      .from("project_settings")
      .select()
      .eq("project_id", project.id);
    const op = (existing as unknown[] | null)?.length
      ? db
          .from("project_settings")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("project_id", project.id)
      : db.from("project_settings").insert([{ project_id: project.id, ...patch }]);
    const { error } = await op;
    setMsg(error ? error.message : "settings saved ✓");
    if (!error) {
      setBotToken("");
      setDeepgramKey("");
      setReplicasKey("");
      setReplicasEnv("");
      setDevinKey("");
      setLimKey("");
      setVerifyUrl("");
      void loadSettings();
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-[var(--shell-text-muted)]">
        loading…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        breadcrumb={`Computah / ${project?.name ?? "…"} / Connections`}
        title="Connections"
        subtitle="Connect Discord, Slack, and more so messages drive the agents."
        icon={<PlugIcon size={18} />}
      />

      {(msg || backendError) && (
        <p className="mt-4 text-[13px] text-[var(--shell-coral)]">{msg || backendError}</p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* channel sources */}
        <Card>
          <CardLabel>/ Channel Sources</CardLabel>
          <div className="mt-5 flex flex-col gap-3">
            {links.length === 0 && (
              <p className="text-[13px] text-[var(--shell-text-muted)]">
                Nothing connected yet — link a channel below and messages start
                replicating both ways within seconds.
              </p>
            )}
            {links.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-md border border-[var(--shell-border)] bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f1efeb] text-[#5865F2]">
                    <DiscordIcon size={18} />
                  </span>
                  <div>
                    <div className="text-[14px] font-medium capitalize text-[var(--shell-text)]">
                      {l.platform}
                    </div>
                    <div className="text-[12px] tabular-nums text-[var(--shell-text-muted)]">
                      {l.external_channel_id}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void disconnect(l.id)}
                  className="rounded-full border border-[var(--shell-border)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-text-muted)] transition hover:border-[var(--shell-coral)] hover:text-[var(--shell-coral)]"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={connect} className="mt-5 flex flex-col gap-2.5">
            <div className={labelCls}>Add a source</div>
            <div className="flex gap-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className={inputCls}
              >
                <option value="discord">Discord</option>
                <option value="slack">Slack</option>
                <option value="maskord">Maskord</option>
              </select>
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="channel id"
                className={`${inputCls} flex-1`}
              />
              <button
                type="submit"
                disabled={!externalId.trim()}
                className="rounded-full bg-[var(--shell-text)] px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--shell-coral)] disabled:opacity-40"
              >
                Connect
              </button>
            </div>
            <p className="text-[12px] text-[var(--shell-text-muted)]">
              Discord: enable Developer Mode → right-click the channel → Copy Channel ID.
              The project&rsquo;s bot must be in that server.
            </p>
          </form>
        </Card>

        {/* project settings */}
        <Card>
          <div className="flex items-center justify-between">
            <CardLabel>/ Project Settings</CardLabel>
            {!isOwner && <CardLabel>owner only</CardLabel>}
          </div>
          {isOwner ? (
            <form onSubmit={saveSettings} className="mt-5 flex flex-col gap-3">
              <label className={labelCls}>
                Discord bot token {saved.bot && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={saved.bot ? "••••••• replace" : "bot token"}
                className={inputCls}
              />
              <label className={labelCls}>
                Deepgram API key {saved.deepgram && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                type="password"
                value={deepgramKey}
                onChange={(e) => setDeepgramKey(e.target.value)}
                placeholder={saved.deepgram ? "••••••• replace" : "for voice transcription"}
                className={inputCls}
              />
              <label className={labelCls}>
                Replicas API key {saved.replicasKey && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                type="password"
                value={replicasKey}
                onChange={(e) => setReplicasKey(e.target.value)}
                placeholder={saved.replicasKey ? "••••••• replace" : "for spawning replicants"}
                className={inputCls}
              />
              <label className={labelCls}>
                Replicas environment id {saved.replicasEnv && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                value={replicasEnv}
                onChange={(e) => setReplicasEnv(e.target.value)}
                placeholder={saved.replicasEnv ? "set — paste to replace" : "environment uuid"}
                className={inputCls}
              />
              <label className={labelCls}>
                Devin API key {saved.devin && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                type="password"
                value={devinKey}
                onChange={(e) => setDevinKey(e.target.value)}
                placeholder={saved.devin ? "••••••• replace" : "say “send Devin to…” to use it"}
                className={inputCls}
              />
              <label className={labelCls}>
                lim.run API key {saved.lim && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                type="password"
                value={limKey}
                onChange={(e) => setLimKey(e.target.value)}
                placeholder={saved.lim ? "••••••• replace" : "so replicants can build mobile"}
                className={inputCls}
              />
              <label className={labelCls}>
                Verify URL {saved.verifyUrl && <span className="text-[var(--shell-coral)]">· set</span>}
              </label>
              <input
                value={verifyUrl}
                onChange={(e) => setVerifyUrl(e.target.value)}
                placeholder="https://staging.yourapp.com — self-verified when a replicant finishes"
                className={inputCls}
              />
              <button
                type="submit"
                className="mt-2 self-start rounded-full bg-[var(--shell-text)] px-6 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[var(--shell-coral)]"
              >
                Save settings
              </button>
              <p className="text-[12px] text-[var(--shell-text-muted)]">
                The bot reads &amp; relays your channel sources (needs View Channels, Send
                Messages, Read Message History + Message Content Intent). Replicas
                credentials power the Listen page&rsquo;s agent spawning.
              </p>
            </form>
          ) : (
            <p className="mt-5 text-[13px] text-[var(--shell-text-muted)]">
              Only the project owner can edit integration settings.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
