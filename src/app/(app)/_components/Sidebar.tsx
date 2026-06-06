import SidebarNavItem from "./SidebarNavItem";
import {
  ActivityIcon,
  ChatBubbleIcon,
  MicIcon,
  PlugIcon,
  SparkleIcon,
} from "./Icons";

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-[268px] flex-col border-r border-[var(--shell-border)] bg-[var(--shell-sidebar)]">
      <div className="px-6 pt-7 pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--shell-peach)] text-[var(--shell-coral)]">
            <SparkleIcon size={16} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-medium text-[var(--shell-text)]">
              Computah
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--shell-text-muted)]">
              Default Workspace
            </span>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        <SidebarNavItem href="/listen" label="Listen" icon={<MicIcon size={17} />} />
        <SidebarNavItem
          href="/iterate"
          label="Iterate"
          icon={<ChatBubbleIcon size={17} />}
        />
        <SidebarNavItem
          href="/connections"
          label="Connections"
          icon={<PlugIcon size={17} />}
        />
        <SidebarNavItem
          href="/activity"
          label="Activity"
          icon={<ActivityIcon size={17} />}
        />
      </nav>

      <div className="px-6 py-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--shell-text-muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--shell-text-soft)]" />
          OFF
        </div>
      </div>
    </aside>
  );
}
