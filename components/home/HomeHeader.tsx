import Link from "next/link";
import { Search, Settings } from "lucide-react";

export default function HomeHeader({ household }: { household: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <h1 className="flex-1 text-4xl font-extrabold leading-tight">
        {household}
      </h1>
      <Link
        href="/search"
        aria-label="Search"
        className="hz-capsule grid h-10 w-10 place-items-center rounded-full"
      >
        <Search size={20} strokeWidth={2.5} />
      </Link>
      <Link
        href="/settings"
        aria-label="Settings"
        className="hz-capsule grid h-10 w-10 place-items-center rounded-full"
      >
        <Settings size={20} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
