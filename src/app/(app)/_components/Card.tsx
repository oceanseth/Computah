type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-[var(--shell-border)] bg-white p-7",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

type CardLabelProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardLabel({ children, className }: CardLabelProps) {
  return (
    <div
      className={[
        "text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--shell-text-muted)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
