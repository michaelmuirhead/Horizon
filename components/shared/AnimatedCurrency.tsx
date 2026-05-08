"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatCurrency } from "@/lib/format";

const DEFAULT_DURATION = 650;
const DELTA_FADE_MS = 1100;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// ease-out cubic — slow finish that feels like the number "settles" into
// place rather than abruptly stopping.
function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}

type Props = {
  value: number;
  // Tween length in ms. Longer feels luxurious, shorter feels snappy; the
  // current default leans snappy so a quick add/delete still finishes
  // before the user looks away.
  durationMs?: number;
  // Tailwind class applied to the rendered currency span. The wrapping
  // element is always position-relative so the floating delta chip can
  // anchor to it.
  className?: string;
  // Color tone keyed off the underlying value, so the digits track sign.
  // Forwarded by the caller; AnimatedCurrency layers a brief halo flash
  // on top to mark the direction of change.
  toneClassName?: string;
};

type Direction = "up" | "down";

type DeltaChip = {
  // Monotonic key so React remounts the chip on every change (otherwise
  // the second tick within a second would re-use the same DOM node and
  // skip its animation).
  key: number;
  amount: number;
  direction: Direction;
};

export default function AnimatedCurrency({
  value,
  durationMs = DEFAULT_DURATION,
  className,
  toneClassName,
}: Props) {
  // First-render snap: we want the page to load showing the current
  // balance, not roll up from $0 every time the route mounts.
  const [display, setDisplay] = useState(value);
  const [popKey, setPopKey] = useState(0);
  const [glow, setGlow] = useState<Direction | null>(null);
  const [delta, setDelta] = useState<DeltaChip | null>(null);

  const previousValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const previous = previousValueRef.current;
    if (value === previous) return;
    previousValueRef.current = value;

    const change = value - previous;
    const direction: Direction = change >= 0 ? "up" : "down";

    setPopKey((k) => k + 1);
    setGlow(direction);
    setDelta({ key: Date.now(), amount: change, direction });

    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = setTimeout(() => setGlow(null), 820);

    if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    deltaTimerRef.current = setTimeout(() => setDelta(null), DELTA_FADE_MS + 50);

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Continue from whatever's currently on screen so a second tick
    // mid-tween doesn't snap back to the previous "from".
    let from = display;
    const startTime = performance.now();
    const span = value - from;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = elapsed / durationMs;
      if (t >= 1) {
        setDisplay(value);
        rafRef.current = null;
        return;
      }
      setDisplay(from + span * easeOutCubic(t));
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    // We deliberately exclude `display` from deps — re-running the effect
    // every animation frame would be a fight with itself. The "continue
    // from current display" behaviour reads the latest value via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
      if (deltaTimerRef.current) clearTimeout(deltaTimerRef.current);
    };
  }, []);

  const glowStyle: CSSProperties | undefined = glow
    ? {
        // The mint and rose RGB triples below are the palette's success /
        // warning colours; passing them in as a CSS var lets the keyframe
        // stay single-purpose while the caller tone-maps the flash.
        ["--hz-glow-rgb" as string]:
          glow === "up" ? "36 198 154" : "244 63 94",
      }
    : undefined;

  return (
    <span className="relative inline-block">
      <span
        className={`inline-block rounded-2xl ${
          glow ? "hz-glow" : ""
        }`}
        style={glowStyle}
      >
        <span
          key={popKey}
          className={`inline-block hz-pop ${toneClassName ?? ""} ${className ?? ""}`}
        >
          {formatCurrency(display)}
        </span>
      </span>
      {delta && delta.amount !== 0 && (
        <span
          key={delta.key}
          aria-hidden
          className={`pointer-events-none absolute -right-1 top-1 text-sm font-bold tabular-nums ${
            delta.direction === "up"
              ? "hz-rise-up text-emerald-400"
              : "hz-rise-down text-rose-400"
          }`}
        >
          {delta.direction === "up" ? "+" : "−"}
          {formatCurrency(Math.abs(delta.amount))}
        </span>
      )}
    </span>
  );
}
