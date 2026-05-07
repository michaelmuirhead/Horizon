import { Coffee, Leaf, Trash2, type LucideIcon } from "lucide-react";

type Card = {
  Icon: LucideIcon;
  rotate: number;
  yOffset: number;
};

const cards: Card[] = [
  { Icon: Trash2, rotate: -10, yOffset: 6 },
  { Icon: Coffee, rotate: 0, yOffset: 0 },
  { Icon: Leaf, rotate: 10, yOffset: 6 },
];

export default function PinnedIllustration() {
  return (
    <div className="flex justify-center items-end h-32">
      {cards.map(({ Icon, rotate, yOffset }, i) => (
        <div
          key={i}
          className="relative -mx-2"
          style={{
            transform: `rotate(${rotate}deg) translateY(${yOffset}px)`,
          }}
        >
          <span
            aria-hidden
            className="absolute left-1/2 -top-1.5 h-3 w-3 -translate-x-1/2 rounded-full bg-mint ring-1 ring-fg/30"
          />
          <div className="flex items-center justify-center h-24 w-[78px] rounded-md bg-mint/30">
            <Icon size={32} strokeWidth={2} className="text-mint" />
          </div>
        </div>
      ))}
    </div>
  );
}
