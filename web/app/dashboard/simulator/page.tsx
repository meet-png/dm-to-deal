import { Simulator } from "@/components/Simulator";

export default function SimulatorPage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="mono-label">simulator</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-fog">Talk to the agent</h1>
        <p className="mt-2 max-w-xl text-sm text-fog-muted">
          Play the lead. The agent replies in the influencer&apos;s voice and advances the pipeline
          in real time — the same loop that runs on live Instagram DMs.
        </p>
      </header>
      <div className="max-w-2xl">
        {/* Operator dashboard → persist=true so the live conversation
            shows up on the pipeline board in real time. */}
        <Simulator persist />
      </div>
      <p className="mt-4 max-w-2xl text-xs text-fog-faint">
        Tip: open the <a href="/dashboard" className="text-signal hover:underline">overview</a> in a
        second tab and watch the lead move through the pipeline as you reply.
      </p>
    </div>
  );
}
