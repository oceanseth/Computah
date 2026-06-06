"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export default function SidebarNavItem({ href, label, icon }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors",
        isActive
          ? "bg-[var(--shell-sidebar-active)] text-[var(--shell-text)]"
          : "text-[#4a4844] hover:bg-[var(--shell-sidebar-active)]/60",
      ].join(" ")}
    >
      <span className="text-[#4a4844]">{icon}</span>
      <span className="font-normal">{label}</span>
    </Link>
  );
}
