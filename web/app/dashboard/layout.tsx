import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DashboardNav } from "@/components/DashboardNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/40 px-5 py-6 md:flex">
        <Logo href="/dashboard" />
        <p className="mono-label mt-1 pl-5">operator console</p>
        <DashboardNav />
        <div className="mt-auto">
          <Link href="/" className="text-xs text-fog-faint transition hover:text-fog">
            ← back to site
          </Link>
        </div>
      </aside>
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
