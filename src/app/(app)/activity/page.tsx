import { Card, CardLabel } from "../_components/Card";
import PageHeader from "../_components/PageHeader";
import { ActivityIcon } from "../_components/Icons";
import ActivityFeed from "../_components/ActivityFeed";

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
          <div className="mt-4 flex-1">
            <ActivityFeed />
          </div>
        </Card>
      </div>
    </div>
  );
}
