import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Props = {
  Icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
};

export default function AccentActionButton({
  Icon,
  label,
  onClick,
  href,
}: Props) {
  const className =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-card-elevated px-5 py-4 text-base font-bold text-accent";
  const content = (
    <>
      <Icon size={20} strokeWidth={2.4} />
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
