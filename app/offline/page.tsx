import { CloudOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-3xl bg-card-elevated text-fg/80">
        <CloudOff size={32} strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-extrabold">You&rsquo;re offline</h1>
      <p className="max-w-xs text-base text-fg/70">
        Horizon stores everything locally, so most of the app will keep
        working once you&rsquo;re back. Try again in a moment.
      </p>
    </div>
  );
}
