import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  Icon: LucideIcon;
  href?: string;
  children: React.ReactNode;
};

export default function ReportCard({ title, Icon, href, children }: Props) {
  const header = (
    <div className="flex items-center gap-2">
      <Icon size={18} strokeWidth={2.4} className="text-accent" />
      <h2 className="flex-1 text-base font-bold text-accent">{title}</h2>
      {href && <ChevronRight size={18} className="text-accent/80" />}
    </div>
  );

  return (
    <section className="rounded-3xl bg-card p-5">
      {href ? (
        <Link href={href} className="block">
          {header}
        </Link>
      ) : (
        header
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
