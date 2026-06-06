import { Card, CardLabel } from "../_components/Card";
import EmptyState from "../_components/EmptyState";
import PageHeader from "../_components/PageHeader";
import { ActivityIcon } from "../_components/Icons";

export default function ActivityPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Computah / Activity"
        title="Activity"
        subtitle="Recent agent runs and platform messages."
        icon={<ActivityIcon size={18} />}
      />

      <div className="mt-8">
        <Card className="flex min-h-[360px] flex-col">
          <CardLabel>/ Recent Activity</CardLabel>
          <EmptyState
            icon={<ActivityIcon size={56} />}
            title="Nothing yet"
            description="When agents run or messages arrive, they'll show up here."
          />
        </Card>
      </div>
    </div>
  );
}
