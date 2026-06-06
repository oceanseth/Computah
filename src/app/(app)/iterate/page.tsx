import { Card } from "../_components/Card";
import PageHeader from "../_components/PageHeader";
import { ChatBubbleIcon } from "../_components/Icons";

export default function IteratePage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Computah / Iterate"
        title="Iterate"
        subtitle="Refine what the agents are doing."
        icon={<ChatBubbleIcon size={18} />}
      />

      <div className="mt-8">
        <Card className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <div className="text-[15px] font-semibold text-[var(--shell-text)]">
              Coming soon
            </div>
            <div className="mt-1.5 text-[13px] text-[var(--shell-text-muted)]">
              This surface is on the roadmap.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
