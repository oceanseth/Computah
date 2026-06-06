import Sidebar from "./_components/Sidebar";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--shell-bg)] text-[var(--shell-text)]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1200px] px-12 pt-8 pb-16">
          {children}
        </div>
      </main>
    </div>
  );
}
