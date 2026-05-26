"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { useActivePersona } from "@/lib/use-active-persona";

/**
 * Read-only view of the active influencer's personality profile — "the moat".
 * (Editing/persisting profiles is a Phase-1 item; see docs/ROADMAP.md.)
 *
 * When demo mode is on, this shows the active demo persona's profile so the
 * dashboard reads coherently across pages. A banner makes it clear which
 * profile is the live backend one and which is scripted.
 */
export default function PersonalityPage() {
  const [realProfile, setRealProfile] = useState<Profile | null>(null);
  const [offline, setOffline] = useState(false);
  const { persona, enabled: demoEnabled } = useActivePersona();

  useEffect(() => {
    api
      .profile()
      .then(setRealProfile)
      .catch(() => setOffline(true));
  }, []);

  const profile: Profile | null = demoEnabled ? persona.profile : realProfile;
  const showingDemo = demoEnabled;

  return (
    <div className="space-y-6">
      <header>
        <p className="mono-label">personality</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-fog">The voice profile</h1>
        <p className="mt-2 max-w-xl text-sm text-fog-muted">
          What makes the agent sound like the creator, not a bot. This profile is compiled into the
          cached system prompt for every conversation.
        </p>
      </header>

      {showingDemo && (
        <div className="card flex items-start gap-3 border-signal/30 p-4">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded border border-signal/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-signal">
            sim
          </span>
          <div className="text-sm text-fog-muted">
            Showing the <span className="text-fog">{persona.label}</span> demo persona. Switch on the
            overview page, or unset{" "}
            <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-signal">
              NEXT_PUBLIC_SHOW_DEMO_LEADS
            </code>{" "}
            to see the live backend profile.
          </div>
        </div>
      )}

      {offline && !showingDemo && (
        <p className="font-mono text-sm text-warm">Backend offline — run `npm run dev`.</p>
      )}

      {profile && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Name" value={profile.name} />
          <Field label="Niche" value={profile.niche} />
          <Field label="Offer" value={profile.offer} wide />
          <Field label="Tone" value={profile.tone} wide />
          <Field label="Emoji habits" value={profile.emojiHabits} />
          <Field label="Lead magnet" value={profile.leadMagnet} />
          <ListField label="Signature phrases" items={profile.signaturePhrases} />
          <ListField label="Common objections" items={profile.commonObjections} />
          <ListField label="Recent captions (voice grounding)" items={profile.recentCaptions} wide />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-fog">{value}</p>
    </div>
  );
}

function ListField({ label, items, wide }: { label: string; items: string[]; wide?: boolean }) {
  return (
    <div className={`card p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <p className="mono-label">{label}</p>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex gap-2 text-sm text-fog-muted">
            <span className="text-signal">—</span> {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
