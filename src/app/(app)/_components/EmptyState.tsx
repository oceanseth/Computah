type Props = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

export default function EmptyState({ icon, title, description }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="text-[var(--shell-text-soft)]">{icon}</div>
      <div className="mt-5 text-[15px] font-semibold text-[var(--shell-text)]">
        {title}
      </div>
      <div className="mt-1.5 max-w-xs text-[13px] text-[var(--shell-text-muted)]">
        {description}
      </div>
    </div>
  );
}
