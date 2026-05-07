import BottomNav from "@/components/layout/BottomNav";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";
import OnboardingGate from "@/components/layout/OnboardingGate";
import UndoToast from "@/components/layout/UndoToast";

export default function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingGate>
      <a href="#main" className="hz-skip-link">
        Skip to content
      </a>
      <div className="md:pl-20">
        <div className="relative mx-auto max-w-md md:max-w-3xl lg:max-w-5xl min-h-[100dvh]">
          <main id="main" className="pb-28 md:pb-10">
            {children}
          </main>
          <BottomNav />
          <UndoToast />
          <KeyboardShortcuts />
        </div>
      </div>
    </OnboardingGate>
  );
}
