import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Simulator } from "@/components/Simulator";

export default function LandingPage() {
  return (
    <main className="relative">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-fog-muted md:flex">
          <a href="#how" className="transition hover:text-fog">How it works</a>
          <a href="#features" className="transition hover:text-fog">Features</a>
          <a href="#pricing" className="transition hover:text-fog">Pricing</a>
          <Link href="/dashboard" className="transition hover:text-fog">Dashboard</Link>
        </nav>
        <a href="#demo" className="btn-signal text-sm">Try the live agent →</a>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="grid-texture relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="animate-fade-up">
          <span className="mono-label inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/60 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" /> autonomous · in your voice · 24/7
          </span>
          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-fog sm:text-6xl">
            Turn your silent audience into{" "}
            <span className="text-signal">booked calls.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-fog-muted">
            DM-to-Deal is an AI sales agent that lives in an influencer&apos;s Instagram —
            it captures warm leads, talks to them in your exact voice, books the call,
            and tracks every dollar. Automatically.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#demo" className="btn-signal">Try the live agent →</a>
            <Link href="/dashboard" className="btn-ghost">See the dashboard</Link>
          </div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-ink-700 pt-6">
            <Stat value="~5 msgs" label="to book a call" />
            <Stat value="$0.02–0.05" label="per conversation" />
            <Stat value="100%" label="platform-safe" />
          </dl>
        </div>
        <div id="demo" className="animate-fade-up [animation-delay:120ms]">
          <p className="mono-label mb-3">▌ live demo — talk to the agent</p>
          <Simulator />
          <p className="mt-3 font-mono text-[11px] text-fog-faint">
            Real agent logic. Reply as a lead and watch the pipeline move.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-mono text-xl text-fog">{value}</dt>
      <dd className="mt-1 text-xs text-fog-faint">{label}</dd>
    </div>
  );
}

function Problem() {
  const points = [
    "Most followers never message you — they assume they'll be ignored.",
    "You don't have time to DM and nurture hundreds of people.",
    "When leads do come in, there's no system to qualify or book them.",
    "Revenue leaks everywhere — no follow-up, no pipeline, no tracking.",
  ];
  return (
    <section className="border-y border-ink-700/60 bg-ink-900/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="mono-label">the problem</p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
          Your warmest leads are sitting in your DMs, going cold.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {points.map((p) => (
            <div key={p} className="card flex gap-3 p-5">
              <span className="mt-1 text-signal">—</span>
              <p className="text-fog-muted">{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Capture", "A follower comments your keyword. The agent detects it instantly."],
    ["Open", "It sends a warm, personal first DM in your voice — delivering what you promised."],
    ["Converse", "It qualifies, builds rapport, and handles objections like a top closer."],
    ["Book", "Within ~5 messages it positions a free call and drops your booking link."],
    ["Track", "Every lead, booking, and dollar lands in your dashboard automatically."],
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20">
      <p className="mono-label">how it works</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
        Content to closed revenue, on autopilot.
      </h2>
      <ol className="mt-12 grid gap-6 md:grid-cols-5">
        {steps.map(([title, body], i) => (
          <li key={title} className="relative">
            <span className="font-mono text-sm text-signal">0{i + 1}</span>
            <h3 className="mt-2 font-display text-lg font-medium text-fog">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-fog-muted">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  const features = [
    ["Sounds exactly like you", "A per-creator voice profile learned from your captions and tone. Leads believe it's you."],
    ["Books within 5 messages", "Modeled on elite closer psychology — warm, confident, never pushy."],
    ["Platform-safe by design", "Only ever messages people who engaged first. No scraping, no cold DMs, ever."],
    ["Tracks every dollar", "Pipeline, bookings, win-rate and revenue — live, in one dashboard."],
    ["Costs pennies", "A full 8–10 message conversation runs $0.02–0.05. Hundreds of leads for a few dollars."],
    ["Never sleeps", "Replies in minutes, any hour, and never forgets a follow-up."],
  ];
  return (
    <section id="features" className="border-y border-ink-700/60 bg-ink-900/30">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <p className="mono-label">why it wins</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
          A top closer that scales to your whole audience.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([title, body]) => (
            <div key={title} className="card p-6 transition hover:border-signal/40">
              <h3 className="font-display text-lg font-medium text-fog">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fog-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <p className="mono-label">pricing</p>
      <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-fog sm:text-4xl">
        Done-for-you. You just show up to the calls.
      </h2>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <PriceCard
          tier="Creator"
          price="$500"
          blurb="For a single influencer ready to monetize their audience."
          points={["1 connected account", "Voice profile built for you", "Booking + revenue dashboard"]}
        />
        <PriceCard
          tier="Pro"
          price="$1,500"
          featured
          blurb="For serious creators and small teams who want it dialed in."
          points={["Everything in Creator", "Objection + booking optimization", "Priority support"]}
        />
        <PriceCard
          tier="Agency"
          price="Let's talk"
          blurb="For appointment setters running calls for multiple creators."
          points={["Multiple accounts", "White-label option", "Onboarding playbook"]}
        />
      </div>
    </section>
  );
}

function PriceCard({
  tier,
  price,
  blurb,
  points,
  featured,
}: {
  tier: string;
  price: string;
  blurb: string;
  points: string[];
  featured?: boolean;
}) {
  return (
    <div className={`card flex flex-col p-7 ${featured ? "border-signal/50 shadow-signal" : ""}`}>
      {featured && <span className="mono-label mb-2 text-signal">most popular</span>}
      <h3 className="font-display text-xl font-semibold text-fog">{tier}</h3>
      <p className="mt-2 font-mono text-3xl text-fog">
        {price}
        {price.startsWith("$") && <span className="text-base text-fog-faint">/mo</span>}
      </p>
      <p className="mt-3 text-sm text-fog-muted">{blurb}</p>
      <ul className="mt-5 space-y-2 text-sm text-fog-muted">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="text-signal">✓</span> {p}
          </li>
        ))}
      </ul>
      <a href="#cta" className={`mt-7 text-center ${featured ? "btn-signal" : "btn-ghost"}`}>
        Get started
      </a>
    </div>
  );
}

function FinalCta() {
  return (
    <section id="cta" className="border-t border-ink-700/60 bg-ink-900/40">
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight text-fog sm:text-5xl">
          Your audience is ready. <span className="text-signal">Is your inbox?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-fog-muted">
          Onboarding a small number of creators and appointment setters. See a live demo of the
          agent working on a real conversation.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href="#demo" className="btn-signal">Try the live agent</a>
          <Link href="/dashboard" className="btn-ghost">Explore the dashboard</Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-700/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-fog-faint sm:flex-row">
        <Logo />
        <p className="font-mono text-xs">built by Meet Kabra · DM-to-Deal</p>
      </div>
    </footer>
  );
}
