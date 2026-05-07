"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHorizonStore } from "@/components/store/HorizonStore";

// Redirects new users to /onboard the first time they open the app. Users who
// arrived with existing data are silently marked complete so we don't bug
// them. The wizard sets onboardingCompleted to true; after that this is a
// no-op.
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { settings, setSettings, accounts, transactions } = useHorizonStore();

  useEffect(() => {
    if (settings.onboardingCompleted) return;
    // Treat the seed (one USAA account, two seed transactions) as "fresh".
    // Anything beyond that means the user already has data; mark complete.
    const isSeed =
      accounts.length === 1 &&
      accounts[0]?.id === "usaa" &&
      transactions.length === 2;
    if (!isSeed) {
      setSettings({ ...settings, onboardingCompleted: true });
      return;
    }
    if (pathname !== "/onboard") {
      router.replace("/onboard");
    }
  }, [settings, accounts, transactions, pathname, router, setSettings]);

  return <>{children}</>;
}
