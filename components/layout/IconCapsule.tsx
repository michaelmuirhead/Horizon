import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  ariaLabel?: string;
};

export default function IconCapsule({ children, ariaLabel }: Props) {
  return (
    <div
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-full bg-card-elevated divide-x divide-fg/10"
    >
      {children}
    </div>
  );
}

type CapsuleButtonProps = {
  children: ReactNode;
  ariaLabel: string;
  onClick?: () => void;
  href?: string;
};

export function CapsuleButton({
  children,
  ariaLabel,
  onClick,
  href,
}: CapsuleButtonProps) {
  const className = "grid h-10 w-12 place-items-center text-fg";
  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}
