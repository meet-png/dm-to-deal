import Link from "next/link";

/** Wordmark with a small live-signal dot. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-signal" />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-fog">
        DM<span className="text-signal">‑to‑</span>Deal
      </span>
    </Link>
  );
}
