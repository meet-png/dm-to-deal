"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/dashboard", "Overview"],
  ["/dashboard/simulator", "Simulator"],
  ["/dashboard/personality", "Personality"],
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-8 flex flex-col gap-1">
      {ITEMS.map(([href, label]) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-signal/10 text-signal"
                : "text-fog-muted hover:bg-ink-800 hover:text-fog"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
