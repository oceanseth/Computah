import { Card, CardLabel } from "../_components/Card";
import EmptyState from "../_components/EmptyState";
import PageHeader from "../_components/PageHeader";
import { HeadphonesIcon, InboxIcon, MicIcon } from "../_components/Icons";

export default function ListenPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Computah / Listen"
        title="Listen"
        subtitle="Computah hears every word. It only acts when you ask."
        icon={<MicIcon size={18} />}
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[var(--shell-text)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-text)] transition-colors hover:bg-[var(--shell-text)] hover:text-white"
          >
            <MicIcon size={14} />
            Start Listening
          </button>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex min-h-[360px] flex-col">
          <CardLabel>/ Live Transcript</CardLabel>
          <EmptyState
            icon={<HeadphonesIcon size={64} />}
            title="Not listening"
            description="Click Start Listening to begin transcription."
          />
        </Card>

        <Card className="flex min-h-[360px] flex-col">
          <div className="flex items-center justify-between">
            <CardLabel>/ Proposed Actions</CardLabel>
            <CardLabel>0 Cards</CardLabel>
          </div>
          <EmptyState
            icon={<InboxIcon size={64} />}
            title="Nothing pending"
            description="Speak an instruction and a card will appear here."
          />
        </Card>
      </div>
    </div>
  );
}
