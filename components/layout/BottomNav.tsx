"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Banknote,
  Landmark,
  BarChart3,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
};

// TODO: drive `badge` from a notifications store once one exists.
const tabs: Tab[] = [
  { href: "/", label: "Home", icon: Home, badge: 1 },
  { href: "/budget", label: "Budget", icon: BookOpen },
  { href: "/spending", label: "Spending", icon: Banknote },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/reflect", label: "Reflect", icon: BarChart3 },
  { href: "/planner", label: "Planner", icon: CalendarClock },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Phone: floating pill bar pinned to the bottom. */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="mx-auto max-w-md px-3 pb-3">
          <ul className="flex items-center justify-between rounded-full bg-card-elevated/95 backdrop-blur px-2 py-2 shadow-2xl">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              const Icon = tab.icon;
              return (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={tab.href}
                    className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-colors"
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={`relative flex items-center justify-center h-8 w-12 rounded-full transition-colors ${
                        active ? "bg-accent/15" : ""
                      }`}
                    >
                      <Icon
                        size={22}
                        strokeWidth={active ? 2.4 : 2}
                        className={active ? "text-accent" : "text-fg/80"}
                      />
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span
                          aria-label={`${tab.badge} new`}
                          className="absolute -right-0.5 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-fg ring-2 ring-card-elevated"
                        >
                          {tab.badge}
                        </span>
                      )}
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        active ? "text-accent" : "text-fg/80"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* iPad+: vertical rail pinned to the left edge. */}
      <nav
        className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 w-20 flex-col items-center justify-center gap-1 bg-card-elevated/80 backdrop-blur border-r border-fg/5 py-4"
        aria-label="Primary"
      >
        <ul className="flex flex-col items-stretch gap-1 w-full px-2">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-colors ${
                    active ? "bg-accent/15" : "hover:bg-white/5"
                  }`}
                >
                  <span className="relative flex items-center justify-center h-7 w-12">
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.4 : 2}
                      className={active ? "text-accent" : "text-fg/80"}
                    />
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        aria-label={`${tab.badge} new`}
                        className="absolute -right-1 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-fg ring-2 ring-card-elevated"
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      active ? "text-accent" : "text-fg/80"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
