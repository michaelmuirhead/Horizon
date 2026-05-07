import Link from "next/link";
import { Settings } from "lucide-react";

export default function HomeHeader({ household }: { household: string }) {
  return (
    <div className="flex items-start justify-between">
      <h1 className="text-4xl font-extrabold leading-tight">{household}</h1>
      <Link
        href="/settings"
        aria-label="Settings"
        className="grid h-10 w-10 place-items-center rounded-full bg-black/40"
      >
        <Settings size={20} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
