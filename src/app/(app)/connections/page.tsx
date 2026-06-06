import { Card, CardLabel } from "../_components/Card";
import PageHeader from "../_components/PageHeader";
import { DiscordIcon, PlugIcon } from "../_components/Icons";

export default function ConnectionsPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Computah / Connections"
        title="Connections"
        subtitle="Connect Discord, Slack, and more so messages drive the agents."
        icon={<PlugIcon size={18} />}
      />

      <div className="mt-8">
        <Card>
          <CardLabel>/ Connected Platforms</CardLabel>

          <div className="mt-5 flex items-center justify-between rounded-md border border-[var(--shell-border)] bg-white px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f1efeb] text-[#5865F2]">
                <DiscordIcon size={18} />
              </span>
              <div>
                <div className="text-[14px] font-medium text-[var(--shell-text)]">
                  Discord
                </div>
                <div className="text-[12px] text-[var(--shell-text-muted)]">
                  Drive agents from a Discord channel.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[var(--shell-border)] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--shell-text-muted)]">
                Not connected
              </span>
              <button
                type="button"
                disabled
                className="inline-flex items-center rounded-full border-[1.5px] border-[var(--shell-border)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--shell-text-soft)] cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          </div>

          <div className="mt-4 text-[12px] text-[var(--shell-text-muted)]">
            More platforms coming soon.
          </div>
        </Card>
      </div>
    </div>
  );
}
