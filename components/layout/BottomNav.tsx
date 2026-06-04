"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { TABS, useHiddenTabs, type TabDef } from "@/lib/tabs";

// Per-tab notification badges. None of the other tabs surface a count
// yet, so this is a single entry rather than a field on each tab — but
// the lookup keeps the door open for more later.
// TODO: drive these from a notifications store once one exists.
const BADGES: Partial<Record<TabDef["id"], number>> = { home: 1 };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function BottomNav() {
  const pathname = usePathname();
  const { hidden } = useHiddenTabs();
  const tabs = useMemo(() => {
    const hide = new Set(hidden);
    return TABS.filter((t) => !hide.has(t.id));
  }, [hidden]);

  return (
    <>
      {/* Phone: floating pill bar pinned to the bottom. */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="mx-auto max-w-md px-3 pb-3">
          <ul className="hz-capsule flex items-center justify-between rounded-full backdrop-blur px-2 py-2">
            {tabs.map((tab) => {
              const active = isActive(pathname, tab.href);
              const Icon = tab.icon;
              const badge = BADGES[tab.id];
              return (
                <li key={tab.href} className="flex-1">
                  <Link
                    href={tab.href}
                    className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-full transition-colors"
                    aria-current={active ? "page" : undefined}
                  >
                    <span
                      className={`relative flex items-center justify-center h-8 w-12 rounded-full transition-colors ${
                        active ? "hz-capsule-active" : ""
                      }`}
                    >
                      <Icon
                        size={22}
                        strokeWidth={active ? 2.4 : 2}
                        className={active ? "text-white" : "text-fg/80"}
                      />
                      {badge !== undefined && badge > 0 && (
                        <span
                          aria-label={`${badge} new`}
                          className="hz-pill-danger absolute -right-0.5 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-card-elevated"
                        >
                          {badge}
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
            const badge = BADGES[tab.id];
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 transition-colors ${
                    active ? "hz-capsule-active" : "hover:bg-white/5"
                  }`}
                >
                  <span className="relative flex items-center justify-center h-7 w-12">
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.4 : 2}
                      className={active ? "text-white" : "text-fg/80"}
                    />
                    {badge !== undefined && badge > 0 && (
                      <span
                        aria-label={`${badge} new`}
                        className="hz-pill-danger absolute -right-1 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-card-elevated"
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${
                      active ? "text-white" : "text-fg/80"
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
