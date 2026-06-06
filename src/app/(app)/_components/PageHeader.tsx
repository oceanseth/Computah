type Props = {
  breadcrumb: string;
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
};

export default function PageHeader({
  breadcrumb,
  title,
  subtitle,
  icon,
  action,
}: Props) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--shell-text-muted)]">
        {breadcrumb}
      </div>
      <div className="mt-5 flex items-start justify-between gap-6">
        <div className="flex items-center gap-3">
          {icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f1efeb] text-[var(--shell-text)]">
              {icon}
            </span>
          ) : null}
          <h1 className="text-[34px] font-medium leading-none tracking-tight text-[var(--shell-text)]">
            {title}
          </h1>
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
      <p className="mt-3 text-[15px] text-[var(--shell-text-muted)]">{subtitle}</p>
      <div className="mt-7 h-px w-full bg-[var(--shell-border)]" />
    </div>
  );
}
