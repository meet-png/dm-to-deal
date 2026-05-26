"use client";

import { DEMO_PERSONAS } from "@/lib/demo-personas";
import { useActivePersona } from "@/lib/use-active-persona";

/**
 * Persona switcher — minimal chip row. Active chip uses a single subtle
 * signal-tinted border + text; no shadow glow, no scale.
 */
export function PersonaSwitcher() {
  const { persona, setPersonaId, enabled } = useActivePersona();
  if (!enabled) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
      {DEMO_PERSONAS.map((p) => {
        const active = p.id === persona.id;
        return (
          <button
            key={p.id}
            onClick={() => setPersonaId(p.id)}
            title={`${p.label} — ${p.summary}`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-colors duration-150 ${
              active
                ? "bg-signal/10 text-signal"
                : "text-fog-faint hover:bg-ink-800/60 hover:text-fog-muted"
            }`}
          >
            <span className={active ? "text-signal" : "text-fog-faint/70"}>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}
