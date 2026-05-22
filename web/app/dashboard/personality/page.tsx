"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Profile } from "@/lib/types";

/**
 * Read-only view of the active influencer's personality profile — "the moat".
 * (Editing/persisting profiles is a Phase-1 item; see docs/ROADMAP.md.)
 */
export default function PersonalityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api.profile().then(setProfile).catch(() => setOffline(true));
  }, []);

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

      {offline && <p className="font-mono text-sm text-warm">Backend offline — run `npm run dev`.</p>}

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
