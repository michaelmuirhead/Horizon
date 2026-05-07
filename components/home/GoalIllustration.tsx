import { Sparkles, Briefcase } from "lucide-react";

export default function GoalIllustration() {
  return (
    <div className="relative flex h-32 items-center justify-center">
      <Sparkles
        aria-hidden
        size={14}
        className="absolute text-accent/70"
        style={{ transform: "translate(-52px, -28px)" }}
      />
      <Sparkles
        aria-hidden
        size={10}
        className="absolute text-accent/70"
        style={{ transform: "translate(56px, -10px)" }}
      />
      <Sparkles
        aria-hidden
        size={12}
        className="absolute text-accent/70"
        style={{ transform: "translate(-40px, 30px)" }}
      />
      <Briefcase size={64} strokeWidth={2.2} className="text-mint" />
    </div>
  );
}
