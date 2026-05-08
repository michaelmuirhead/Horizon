"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Banknote,
  BarChart3,
  BookOpen,
  ChevronLeft,
  Home,
  Landmark,
  PiggyBank,
  Plus,
  Sparkles,
} from "lucide-react";

// Mockup gallery: lets us compare four "less flat" visual directions
// side by side without committing to one. Delete this route once a
// direction is picked and rolled out for real.

const STYLES = [
  { id: "glass", label: "Soft Glass" },
  { id: "gradient", label: "Gradient + Glow" },
  { id: "emboss", label: "Embossed" },
  { id: "motion", label: "Motion-led" },
] as const;
type StyleId = (typeof STYLES)[number]["id"];

export default function MockupsPage() {
  const [style, setStyle] = useState<StyleId>("glass");

  return (
    <div className="min-h-dvh bg-page px-4 pt-[max(env(safe-area-inset-top),16px)] pb-12">
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-full bg-card-elevated"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </Link>
          <span className="text-xs font-bold uppercase tracking-widest text-fg/45">
            mockup gallery
          </span>
          <span className="h-9 w-9" />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold">Pill styles</h1>
        <p className="mt-1 text-sm text-fg/55">
          Same widgets, four visual directions. Tap a chip to switch.
        </p>

        <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-full bg-card p-1">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              aria-pressed={style === s.id}
              className={`rounded-full px-2 py-2 text-xs font-bold transition ${
                style === s.id
                  ? "bg-accent text-fg shadow-[0_2px_10px_rgba(99,102,241,0.4)]"
                  : "text-fg/65"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {style === "glass" && <GlassMockup />}
          {style === "gradient" && <GradientMockup />}
          {style === "emboss" && <EmbossMockup />}
          {style === "motion" && <MotionMockup />}
        </div>

        <div className="mt-8 rounded-2xl bg-card-elevated/40 p-4 text-xs text-fg/55">
          <p className="font-bold text-fg/75">How to read these</p>
          <p className="mt-1">
            Each direction renders the same set of widgets — top-bar
            capsules, a primary action, the bottom-nav active tab, a
            Budget category row with its balance pill, a summary card,
            and segmented filter chips. Pick the one you want me to roll
            out across the real app.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SOFT GLASS: backdrop-blur + semi-transparent fill + top-edge gloss
// ─────────────────────────────────────────────────────────────────────
function GlassMockup() {
  const capsule =
    "rounded-full bg-white/[0.07] backdrop-blur-md ring-1 ring-white/15 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.65)]";
  const tabPill =
    "rounded-full bg-white/[0.10] backdrop-blur-md ring-1 ring-white/20 shadow-[0_2px_12px_-4px_rgba(99,102,241,0.45)]";
  const balancePill =
    "rounded-full bg-white/[0.07] backdrop-blur-md ring-1 ring-white/15 px-3.5 py-1.5";
  const card =
    "rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-md ring-1 ring-white/10 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.7)]";
  const button =
    "rounded-full bg-accent/90 backdrop-blur-md ring-1 ring-white/25 shadow-[0_6px_20px_-6px_rgba(99,102,241,0.65)]";

  return (
    <Frame title="Soft glass">
      <TopBar capsuleClass={capsule} />
      <SummaryCard cardClass={card} />
      <BudgetRow pillClass={`${balancePill} text-fg`} />
      <PrimaryAction buttonClass={`${button} text-fg`} />
      <Segmented
        activeClass={`${tabPill} text-fg`}
        idleClass="rounded-full bg-white/[0.04] text-fg/65 ring-1 ring-white/10"
      />
      <BottomNav activeClass={`${tabPill} text-accent`} idleClass="text-fg/65" />
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// GRADIENT + GLOW: subtle vertical gradient + colored halo on focus
// ─────────────────────────────────────────────────────────────────────
function GradientMockup() {
  const capsule =
    "rounded-full bg-gradient-to-b from-card-elevated to-card ring-1 ring-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.4)]";
  const tabPill =
    "rounded-full bg-gradient-to-b from-accent to-accent-soft text-fg shadow-[0_0_22px_rgba(99,102,241,0.55)]";
  const balancePill =
    "rounded-full bg-gradient-to-b from-card-elevated to-card ring-1 ring-white/10 px-3.5 py-1.5 shadow-[0_0_14px_rgba(99,102,241,0.18)]";
  const balancePillNeg =
    "rounded-full bg-gradient-to-b from-rose-900/70 to-rose-950/70 ring-1 ring-rose-400/20 px-3.5 py-1.5 shadow-[0_0_14px_rgba(244,63,94,0.35)]";
  const card =
    "rounded-3xl bg-gradient-to-b from-card-elevated to-card ring-1 ring-white/5 shadow-[0_10px_40px_-12px_rgba(99,102,241,0.25)]";
  const button =
    "rounded-full bg-gradient-to-b from-accent to-accent-soft shadow-[0_8px_28px_-6px_rgba(99,102,241,0.7)]";

  return (
    <Frame title="Gradient + glow">
      <TopBar capsuleClass={capsule} />
      <SummaryCard cardClass={card} />
      <BudgetRow pillClass={`${balancePill} text-fg`} />
      <BudgetRow
        labelOverride="Eating Out"
        subtitleOverride="$60 over · spending limit"
        pillClass={`${balancePillNeg} text-rose-200`}
        amount={-22}
      />
      <PrimaryAction buttonClass={`${button} text-fg`} />
      <Segmented
        activeClass={`${tabPill}`}
        idleClass="rounded-full bg-card-elevated text-fg/65"
      />
      <BottomNav activeClass={`${tabPill}`} idleClass="text-fg/65" />
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EMBOSSED: top highlight + bottom shadow, pressed = inset
// ─────────────────────────────────────────────────────────────────────
function EmbossMockup() {
  // The same shadow stack on every raised surface — top inner bright
  // line + outer drop shadow.
  const raised =
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_2px_4px_rgba(0,0,0,0.45)]";
  const capsule = `rounded-full bg-card-elevated ${raised}`;
  const tabPill = `rounded-full bg-accent text-fg ${raised}`;
  const balancePill = `rounded-full bg-card-elevated ring-1 ring-black/30 ${raised} px-3.5 py-1.5`;
  const card = `rounded-3xl bg-card-elevated ${raised}`;
  const button = `rounded-full bg-accent text-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_4px_0_rgba(0,0,0,0.35),0_8px_18px_-6px_rgba(99,102,241,0.5)] active:translate-y-[2px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_0_0_rgba(0,0,0,0)] transition`;

  return (
    <Frame title="Embossed">
      <TopBar capsuleClass={capsule} />
      <SummaryCard cardClass={card} />
      <BudgetRow pillClass={`${balancePill} text-fg`} />
      <PrimaryAction buttonClass={button} />
      <Segmented
        activeClass={`${tabPill}`}
        idleClass={`rounded-full bg-card-elevated text-fg/65 ${raised}`}
      />
      <BottomNav activeClass={`${tabPill}`} idleClass="text-fg/65" />
      <p className="px-1 text-xs text-fg/45">
        Tap the buttons — they sink in on press.
      </p>
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MOTION-LED: clean at rest; spring press, sheen, pulse on activity
// ─────────────────────────────────────────────────────────────────────
function MotionMockup() {
  const capsule =
    "rounded-full bg-card-elevated ring-1 ring-white/5 transition active:scale-[0.94] active:bg-accent/15";
  const tabPill = "rounded-full bg-accent/15 hz-pulse-mint";
  const balancePill =
    "relative rounded-full bg-pill ring-1 ring-white/5 px-3.5 py-1.5 overflow-hidden hz-sheen";
  const card = "rounded-3xl bg-card hz-pulse-mint";
  const button =
    "rounded-full bg-accent text-fg shadow-[0_8px_28px_-6px_rgba(99,102,241,0.6)] transition active:scale-[0.96]";

  return (
    <Frame title="Motion-led">
      <style>{`
        @keyframes hz-sheen-sweep {
          0%, 60% { transform: translateX(-110%); opacity: 0; }
          70% { opacity: 1; }
          100% { transform: translateX(110%); opacity: 0; }
        }
        .hz-sheen::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%);
          animation: hz-sheen-sweep 2.2s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .hz-sheen::after { animation: none; }
        }
      `}</style>
      <TopBar capsuleClass={capsule} />
      <SummaryCard cardClass={card} />
      <BudgetRow pillClass={`${balancePill} text-fg`} />
      <PrimaryAction buttonClass={button} />
      <Segmented
        activeClass={`${tabPill} text-accent`}
        idleClass="rounded-full bg-card-elevated text-fg/65 transition active:scale-[0.94]"
      />
      <BottomNav activeClass={`${tabPill} text-accent`} idleClass="text-fg/65" />
      <p className="px-1 text-xs text-fg/45">
        Watch the balance pill — it gets a subtle sheen sweep. Tap
        anything for a spring press.
      </p>
    </Frame>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Shared building blocks — each variant just swaps the className on the
// surfaces below so it's apples to apples across all four directions.
// ─────────────────────────────────────────────────────────────────────
function Frame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="hz-fade-in space-y-4">
      <p className="text-xs font-bold uppercase tracking-widest text-fg/45">
        {title}
      </p>
      {children}
    </section>
  );
}

function TopBar({ capsuleClass }: { capsuleClass: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        className={`${capsuleClass} grid h-10 w-10 place-items-center text-fg`}
        aria-label="New"
      >
        <Plus size={18} strokeWidth={2.6} />
      </button>
      <button
        type="button"
        className={`${capsuleClass} flex items-center gap-1.5 px-3.5 py-2 text-sm font-bold text-fg`}
      >
        <Sparkles size={14} strokeWidth={2.4} />
        Capsule
      </button>
    </div>
  );
}

function SummaryCard({ cardClass }: { cardClass: string }) {
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-xs font-medium uppercase tracking-wide text-fg/60">
        May 2026 balance
      </p>
      <p className="mt-1 text-4xl font-extrabold tabular-nums">$1,250.00</p>
      <p className="mt-1 text-xs text-fg/55">12 entries this month</p>
    </div>
  );
}

function BudgetRow({
  pillClass,
  amount = 340,
  labelOverride,
  subtitleOverride,
}: {
  pillClass: string;
  amount?: number;
  labelOverride?: string;
  subtitleOverride?: string;
}) {
  const sign = amount < 0 ? "−" : "";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-list-row px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold">
          {labelOverride ?? "Vacation"}
        </p>
        <p className="mt-0.5 text-xs text-fg/55">
          {subtitleOverride ?? "Need $200/mo for Dec 1, 2026"}
        </p>
      </div>
      <span className={`${pillClass} text-base font-bold tabular-nums`}>
        {sign}${Math.abs(amount).toLocaleString()}
      </span>
    </div>
  );
}

function PrimaryAction({ buttonClass }: { buttonClass: string }) {
  return (
    <button
      type="button"
      className={`${buttonClass} w-full px-5 py-3.5 text-base font-bold`}
    >
      Save
    </button>
  );
}

function Segmented({
  activeClass,
  idleClass,
}: {
  activeClass: string;
  idleClass: string;
}) {
  const items = ["Most short", "Most funded", "Name"];
  const [active, setActive] = useState(0);
  return (
    <div className="flex gap-2">
      {items.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => setActive(i)}
          aria-pressed={i === active}
          className={`px-3.5 py-1.5 text-xs font-bold ${
            i === active ? activeClass : idleClass
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BottomNav({
  activeClass,
  idleClass,
}: {
  activeClass: string;
  idleClass: string;
}) {
  const tabs = [
    { Icon: Home, label: "Home", active: true },
    { Icon: BookOpen, label: "Budget", active: false },
    { Icon: Banknote, label: "Spending", active: false },
    { Icon: Landmark, label: "Accounts", active: false },
    { Icon: BarChart3, label: "Reflect", active: false },
    { Icon: PiggyBank, label: "Savings", active: false },
  ];
  return (
    <div className="rounded-full bg-card-elevated/95 px-2 py-2 backdrop-blur">
      <ul className="flex items-center justify-between">
        {tabs.map(({ Icon, label, active }) => (
          <li key={label} className="flex-1">
            <div className="flex flex-col items-center gap-0.5 px-2 py-1.5">
              <span
                className={`relative flex h-8 w-12 items-center justify-center ${
                  active ? activeClass : ""
                }`}
              >
                <Icon
                  size={20}
                  strokeWidth={active ? 2.4 : 2}
                  className={active ? "text-accent" : idleClass}
                />
              </span>
              <span
                className={`text-[10px] font-semibold ${
                  active ? "text-accent" : idleClass
                }`}
              >
                {label}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
