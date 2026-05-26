"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PERSONA_ID, DEMO_PERSONAS, getPersona, type DemoPersona } from "./demo-personas";

const STORAGE_KEY = "dm.activePersona";
const CHANGE_EVENT = "dm.activePersona.change";

/** Hard kill-switch — set to `false` in production once you have real
 *  traffic and want demo content gone. Default behavior: show. */
export function demoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DEMO_LEADS !== "false";
}

/**
 * Cross-page persona selection. Stored in localStorage so a switch on the
 * overview page is reflected on the personality page (and survives reload).
 * Uses a window-scoped custom event so siblings on the same tab re-render
 * immediately — `storage` events only fire across tabs.
 */
export function useActivePersona(): {
  persona: DemoPersona;
  setPersonaId: (id: string) => void;
  enabled: boolean;
} {
  const [id, setId] = useState<string>(DEFAULT_PERSONA_ID);
  const enabled = demoModeEnabled();

  useEffect(() => {
    if (!enabled) return;
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored && DEMO_PERSONAS.some((p) => p.id === stored)) setId(stored);

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setId(detail);
    };
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, [enabled]);

  function setPersonaId(next: string): void {
    if (!enabled) return;
    if (!DEMO_PERSONAS.some((p) => p.id === next)) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
    setId(next);
  }

  return { persona: getPersona(id), setPersonaId, enabled };
}
