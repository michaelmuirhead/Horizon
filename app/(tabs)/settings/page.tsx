"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Bell,
  Cloud,
  CloudOff,
  ChevronRight,
  Download,
  Layers,
  LogOut,
  Share2,
  Upload,
  UserPlus,
  Wand2,
} from "lucide-react";
import SubpageHeader from "@/components/layout/SubpageHeader";
import FormGroup, { FormRow } from "@/components/forms/FormGroup";
import Select from "@/components/forms/Select";
import {
  type ThemeName,
  useHorizonStore,
} from "@/components/store/HorizonStore";
import { useAuth } from "@/components/auth/AuthContext";

const THEMES: { value: ThemeName; label: string; tagline: string }[] = [
  { value: "auto", label: "Auto", tagline: "Follows your system theme" },
  { value: "dark", label: "Midnight", tagline: "Deep indigo (default)" },
  { value: "light", label: "Daylight", tagline: "Crisp light surfaces" },
  { value: "pokemon", label: "Pokémon", tagline: "Pokéball red on Poké blue" },
];

const SUPPORTED_CURRENCIES = [
  ["USD", "United States dollar"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["CAD", "Canadian dollar"],
  ["AUD", "Australian dollar"],
  ["JPY", "Japanese yen"],
  ["CHF", "Swiss franc"],
  ["INR", "Indian rupee"],
  ["MXN", "Mexican peso"],
  ["BRL", "Brazilian real"],
] as const;

function todayCompact(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function downloadJson(filename: string, body: string) {
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const { settings, setSettings, exportBackup, restoreFromBackup } =
    useHorizonStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreFilename, setRestoreFilename] = useState<string>("");

  function changeCurrency(code: string) {
    if (code === settings.currency) return;
    setSettings({ ...settings, currency: code });
    // Force a reload so every formatCurrency caller re-renders with the new
    // formatter — easier than rewiring every component to subscribe.
    if (typeof window !== "undefined") {
      window.setTimeout(() => window.location.reload(), 100);
    }
  }

  function changeTheme(next: ThemeName) {
    if ((settings.theme ?? "dark") === next) return;
    setSettings({ ...settings, theme: next });
    // No reload needed — the effect on settings.theme flips data-theme on
    // <html> and every CSS variable picks up the new palette in place.
  }

  async function toggleNotifications(next: boolean) {
    if (!next) {
      setSettings({ ...settings, notificationsEnabled: false });
      return;
    }
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      alert("This browser doesn't support notifications.");
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      setSettings({ ...settings, notificationsEnabled: false });
      return;
    }
    setSettings({ ...settings, notificationsEnabled: true });
  }

  function handleExport() {
    const payload = exportBackup();
    downloadJson(`horizon-backup-${todayCompact()}.json`, JSON.stringify(payload, null, 2));
  }

  function handleRestore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFilename(file.name);
    setRestoreError(null);
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") {
          setRestoreError("Backup file isn't a JSON object.");
          return;
        }
        if (
          !window.confirm(
            "Restore from this backup? Everything currently in the app will be replaced.",
          )
        ) {
          return;
        }
        restoreFromBackup(parsed);
        if (typeof window !== "undefined") {
          window.setTimeout(() => window.location.reload(), 100);
        }
      } catch {
        setRestoreError("Couldn't parse that file as JSON.");
      }
    });
  }

  return (
    <>
      <SubpageHeader title="Settings" backHref="/" />
      <div className="px-4 pt-2 pb-10 space-y-4">
        <Link
          href="/budgets"
          className="flex items-center gap-3 rounded-2xl bg-card p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <Layers size={18} strokeWidth={2.4} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold">Budgets</span>
            <span className="mt-0.5 block text-xs text-fg/60">
              Switch between independent budgets, or create one for a side
              project or partner&rsquo;s plan.
            </span>
          </span>
          <ChevronRight size={18} className="text-fg/55" />
        </Link>

        <Link
          href="/settings/rules"
          className="flex items-center gap-3 rounded-2xl bg-card p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <Wand2 size={18} strokeWidth={2.4} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-base font-bold">
              Categorization rules
            </span>
            <span className="mt-0.5 block text-xs text-fg/60">
              Auto-set a category when a payee matches a pattern. Applied to
              new transactions and CSV imports.
            </span>
          </span>
          <ChevronRight size={18} className="text-fg/55" />
        </Link>

        <section>
          <FormGroup>
            <FormRow label="Notifications">
              <button
                type="button"
                role="switch"
                aria-checked={settings.notificationsEnabled === true}
                onClick={() =>
                  toggleNotifications(!settings.notificationsEnabled)
                }
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  settings.notificationsEnabled ? "bg-accent" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                    settings.notificationsEnabled
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </FormRow>
            <FormRow label="Currency" htmlFor="settings-currency">
              <Select
                id="settings-currency"
                value={settings.currency}
                onChange={(e) => changeCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code} className="bg-card">
                    {code} — {name}
                  </option>
                ))}
              </Select>
            </FormRow>
          </FormGroup>
          <p className="px-2 pt-2 text-xs text-fg/55">
            Changing currency reloads the app so every total re-renders.
          </p>
          <p className="px-2 pt-2 text-xs text-fg/55 flex items-center gap-1">
            <Bell size={11} />
            Notifications fire on app open for overspent categories and
            by-date targets due in the next 7 days.
          </p>
        </section>

        <section>
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-fg/55">
            Theme
          </p>
          <div className="grid grid-cols-1 gap-2">
            {THEMES.map((t) => {
              const active = (settings.theme ?? "dark") === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => changeTheme(t.value)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ${
                    active ? "ring-accent" : "ring-fg/5"
                  }`}
                >
                  <ThemeSwatch theme={t.value} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold">{t.label}</span>
                    <span className="mt-0.5 block text-xs text-fg/55">
                      {t.tagline}
                    </span>
                  </span>
                  {active && (
                    <span className="text-xs font-bold text-accent">Active</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <CloudSyncSection />

        <section className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-2 text-accent">
            <Download size={18} strokeWidth={2.4} />
            <h2 className="text-base font-bold">Backup</h2>
          </div>
          <p className="mt-2 text-sm text-fg/70">
            Download every account, transaction, target, planner entry, and
            setting as one JSON file you can stash somewhere safe.
          </p>
          <button
            type="button"
            onClick={handleExport}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-fg"
          >
            <Download size={16} strokeWidth={2.4} />
            Download backup
          </button>
        </section>

        <section className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-2 text-accent">
            <Upload size={18} strokeWidth={2.4} />
            <h2 className="text-base font-bold">Restore</h2>
          </div>
          <p className="mt-2 text-sm text-fg/70">
            Replace everything currently in the app with the contents of a
            previous backup. The app reloads after restoring.
          </p>
          <div className="mt-4">
            <label
              htmlFor="restore-file"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-card-elevated px-5 py-2.5 text-sm font-bold"
            >
              <Upload size={16} strokeWidth={2.4} />
              Choose backup file
            </label>
            <input
              id="restore-file"
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleRestore}
              className="sr-only"
            />
            {restoreFilename && (
              <span className="ml-3 text-sm text-fg/60">
                {restoreFilename}
              </span>
            )}
          </div>
          {restoreError && (
            <p className="mt-3 rounded-md bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
              {restoreError}
            </p>
          )}
        </section>
      </div>
    </>
  );
}

// Sign-in / sign-out + status. Hidden when the app wasn't built with
// Firebase env vars so a local-only deploy doesn't show a feature it
// can't fulfil.
function CloudSyncSection() {
  const { user, status, signOut, error } = useAuth();
  const {
    currentBudgetJoinCode,
    shareCurrentBudget,
    unshareCurrentBudget,
    joinSharedBudget,
  } = useHorizonStore();
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "unconfigured") return null;

  function copyJoinCode() {
    if (!currentBudgetJoinCode) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(currentBudgetJoinCode).catch(() => {});
  }

  async function handleShare() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await shareCurrentBudget(user.uid);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnshare() {
    if (!user || busy) return;
    setBusy(true);
    try {
      await unshareCurrentBudget(user.uid);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user || busy) return;
    setJoinError(null);
    setBusy(true);
    try {
      const result = await joinSharedBudget(user.uid, joinCode, joinName);
      if (!result.ok) setJoinError(result.error ?? "Couldn't join.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-5">
      <div className="flex items-center gap-2 text-accent">
        {status === "signed-in" ? (
          <Cloud size={18} strokeWidth={2.4} />
        ) : (
          <CloudOff size={18} strokeWidth={2.4} />
        )}
        <h2 className="text-base font-bold">Cloud sync</h2>
      </div>
      {status === "signed-in" && user ? (
        <>
          <p className="mt-2 text-sm text-fg/70">
            Signed in as{" "}
            <span className="font-semibold text-fg/90">
              {user.displayName ?? user.email ?? "you"}
            </span>
            .{" "}
            {currentBudgetJoinCode
              ? "This budget is shared with a household — every member sees changes within seconds."
              : "Changes you make on this device push to the cloud and other devices signed in to the same account see them within seconds."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {currentBudgetJoinCode ? (
              <>
                <button
                  type="button"
                  onClick={copyJoinCode}
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-fg"
                >
                  <Share2 size={14} strokeWidth={2.4} />
                  Copy invite code
                </button>
                <button
                  type="button"
                  onClick={handleUnshare}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-card-elevated px-4 py-2 text-sm font-bold text-fg/80 disabled:opacity-40"
                >
                  Leave household
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleShare}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-fg disabled:opacity-40"
              >
                <Share2 size={14} strokeWidth={2.4} />
                {busy ? "Setting up…" : "Share with household"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowJoin((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-card-elevated px-4 py-2 text-sm font-bold text-fg/80"
            >
              <UserPlus size={14} strokeWidth={2.4} />
              Join household
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 rounded-full bg-card-elevated px-4 py-2 text-sm font-bold text-fg/80"
            >
              <LogOut size={14} strokeWidth={2.4} />
              Sign out
            </button>
          </div>

          {currentBudgetJoinCode && (
            <div className="mt-3 rounded-md bg-card-elevated px-3 py-2 font-mono text-sm text-fg/85 select-all">
              {currentBudgetJoinCode}
            </div>
          )}

          {showJoin && (
            <div className="mt-3 rounded-2xl bg-card-elevated p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-fg/60">
                Join an existing household
              </p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Invite code"
                className="w-full rounded-md bg-card px-3 py-2 text-sm font-mono outline-none"
              />
              <input
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                placeholder="Local name (e.g. Family budget)"
                className="w-full rounded-md bg-card px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={
                  busy ||
                  joinCode.trim() === "" ||
                  joinName.trim() === ""
                }
                className="w-full rounded-full bg-accent px-4 py-2 text-sm font-bold text-fg disabled:opacity-40"
              >
                {busy ? "Joining…" : "Join & reload"}
              </button>
              {joinError && (
                <p className="rounded-md bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
                  {joinError}
                </p>
              )}
            </div>
          )}

          <p className="mt-3 text-[11px] text-fg/45">
            Sign-out leaves the local data on this device intact — nothing is
            erased.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-fg/70">
            Sign in with your email and password to sync this budget across
            all of your devices. Last write wins per change, so do edits on
            one device at a time for now.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-card px-3 py-2 text-xs text-fg/70">
            <Cloud size={14} strokeWidth={2.4} />
            You&apos;re signed out — reload the app to see the sign-in
            screen.
          </p>
          {error && (
            <p className="mt-3 rounded-md bg-rose-900/30 px-3 py-2 text-xs text-rose-200">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// Mini visual preview of a theme — three stripes (page / card / accent) so
// the palette is recognisable in the picker before committing to it. The
// "auto" theme renders a dark / light split so it reads as "follows the
// system" without needing to know the current preference.
function ThemeSwatch({ theme }: { theme: ThemeName }) {
  if (theme === "auto") {
    return (
      <span
        aria-hidden
        className="relative grid h-10 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-fg/10"
      >
        <span data-theme="dark" className="absolute inset-y-0 left-0 w-1/2 bg-page" />
        <span data-theme="light" className="absolute inset-y-0 right-0 w-1/2 bg-page" />
      </span>
    );
  }
  return (
    <span
      data-theme={theme}
      aria-hidden
      className="grid h-10 w-12 shrink-0 grid-rows-3 overflow-hidden rounded-lg ring-1 ring-fg/10"
    >
      <span className="bg-page" />
      <span className="bg-card-elevated" />
      <span className="bg-accent" />
    </span>
  );
}
