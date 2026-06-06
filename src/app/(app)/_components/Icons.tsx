type IconProps = {
  className?: string;
  size?: number;
};

function baseProps(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
}

export function SparkleIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M12 3l1.8 5.4a4 4 0 0 0 2.8 2.8L22 13l-5.4 1.8a4 4 0 0 0-2.8 2.8L12 23l-1.8-5.4a4 4 0 0 0-2.8-2.8L2 13l5.4-1.8a4 4 0 0 0 2.8-2.8L12 3z" />
    </svg>
  );
}

export function MicIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </svg>
  );
}

export function ChatBubbleIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function PlugIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M7 8h10v4a5 5 0 0 1-10 0V8z" />
      <path d="M12 17v5" />
    </svg>
  );
}

export function ActivityIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 12h4l2-7 4 14 2-7h6" />
    </svg>
  );
}

export function HeadphonesIcon({ className, size = 64 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M4 15v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2z" />
      <path d="M20 15v3a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h1a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function InboxIcon({ className, size = 64 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M3 13l3-8h12l3 8" />
      <path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      <path d="M3 13h5l1 2h6l1-2h5" />
    </svg>
  );
}

export function DiscordIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19.27 5.33A17.4 17.4 0 0 0 15.06 4l-.18.32a16 16 0 0 0-5.76 0L8.94 4a17.4 17.4 0 0 0-4.2 1.33C2.15 9.27 1.45 13.1 1.8 16.88a17.5 17.5 0 0 0 5.36 2.71c.43-.58.81-1.2 1.13-1.85-.62-.23-1.21-.51-1.77-.84.15-.1.29-.21.43-.32a12.5 12.5 0 0 0 10.1 0c.14.11.28.22.43.32-.56.33-1.15.61-1.77.84.32.65.7 1.27 1.13 1.85a17.5 17.5 0 0 0 5.36-2.71c.42-4.39-.71-8.18-3.43-11.55zM8.52 14.61c-1.03 0-1.88-.95-1.88-2.11s.83-2.11 1.88-2.11 1.9.96 1.88 2.11c0 1.16-.84 2.11-1.88 2.11zm6.96 0c-1.03 0-1.88-.95-1.88-2.11s.83-2.11 1.88-2.11 1.9.96 1.88 2.11c0 1.16-.83 2.11-1.88 2.11z" />
    </svg>
  );
}

export function ChessIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
