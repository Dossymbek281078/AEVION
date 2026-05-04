"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBuildAuth } from "@/lib/build/auth";
import { buildApi, buildLogin, buildRegister, BuildApiError } from "@/lib/build/api";
import { ToastProvider } from "./Toast";
import { HeaderSearch } from "./HeaderSearch";

const NAV: { href: string; label: string; authOnly?: boolean }[] = [
  { href: "/build", label: "Projects" },
  { href: "/build/vacancies", label: "Vacancies" },
  { href: "/build/talent", label: "Talent", authOnly: true },
  { href: "/build/coach", label: "AI Coach", authOnly: true },
  { href: "/build/applications", label: "My Apps", authOnly: true },
  { href: "/build/trials", label: "Trials", authOnly: true },
  { href: "/build/reviews", label: "Reviews", authOnly: true },
  { href: "/build/saved", label: "Saved", authOnly: true },
  { href: "/build/dashboard", label: "Dashboard", authOnly: true },
  { href: "/build/create-project", label: "New project", authOnly: true },
  { href: "/build/profile", label: "Profile", authOnly: true },
  { href: "/build/messages", label: "Messages", authOnly: true },
  { href: "/build/pricing", label: "Pricing" },
  { href: "/build/loyalty", label: "Loyalty" },
  { href: "/build/leaderboard", label: "Leaderboard" },
  { href: "/build/success-stories", label: "Success Stories" },
  { href: "/build/help", label: "Help" },
  { href: "/build/why-aevion", label: "Why us" },
];

const TIER_CHIP: Record<string, { className: string; emoji: string }> = {
  DEFAULT: { className: "border-white/10 bg-white/5 text-slate-300", emoji: "🪨" },
  BRONZE: { className: "border-amber-700/40 bg-amber-700/15 text-amber-200", emoji: "🥉" },
  SILVER: { className: "border-slate-400/40 bg-slate-400/15 text-slate-100", emoji: "🥈" },
  GOLD: { className: "border-yellow-400/40 bg-yellow-500/15 text-yellow-100", emoji: "🥇" },
  PLATINUM: { className: "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-100", emoji: "💎" },
};

export function BuildShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useBuildAuth((s) => s.user);
  const logout = useBuildAuth((s) => s.logout);
  const hydrated = useBuildAuth((s) => s.hydrated);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close the drawer on route change so taps on a link feel instant.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  const visibleNav = NAV.filter((n) => !n.authOnly || !!user);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-200 hover:bg-white/10 sm:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
            <Link href="/build" className="flex items-center gap-2 text-sm font-semibold tracking-wide">
              <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-emerald-950">QBuild</span>
              <span className="hidden text-slate-400 sm:inline">AEVION Construction & Recruiting</span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 sm:flex">
            {visibleNav.slice(0, 7).map((n) => {
              const active = pathname === n.href || (n.href !== "/build" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
            {visibleNav.length > 7 && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="More menu"
              >
                More…
              </button>
            )}
          </nav>

          <div className="hidden md:block">
            <HeaderSearch />
          </div>

          <div className="flex items-center gap-2 text-xs">
            {hydrated && user ? (
              <>
                {user.role === "ADMIN" && (
                  <Link
                    href="/build/admin"
                    className="rounded-md bg-fuchsia-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-200 hover:bg-fuchsia-500/30"
                  >
                    Admin
                  </Link>
                )}
                <PlanBadge />
                <TierBadge />
                <NotificationBell />
                <Link
                  href="/build/settings"
                  title="Account settings"
                  className={`rounded-md border border-white/10 px-2.5 py-1.5 text-slate-200 hover:bg-white/10 ${pathname === "/build/settings" ? "bg-white/10" : ""}`}
                >
                  ⚙
                </Link>
              </>
            ) : (
              <span className="text-slate-500">Not signed in</span>
            )}
          </div>
        </div>
      </header>

      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={visibleNav}
        pathname={pathname}
        signedIn={!!user}
        onLogout={logout}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      {hydrated && user && pathname !== "/build/coach" && <FloatingCoachLauncher />}
      <footer className="border-t border-white/5 mt-8">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
          <div className="flex flex-wrap gap-4">
            <Link href="/build/help" className="hover:text-slate-300">Help</Link>
            <Link href="/build/stats" className="hover:text-slate-300">Platform stats</Link>
            <Link href="/build/leaderboard" className="hover:text-slate-300">Leaderboard</Link>
            <Link href="/build/success-stories" className="hover:text-slate-300">Success stories</Link>
            <Link href="/build/why-aevion" className="hover:text-slate-300">Why AEVION</Link>
            <Link href="/build/pricing" className="hover:text-slate-300">Pricing</Link>
          </div>
          <span>© 2026 AEVION QBuild</span>
        </div>
      </footer>
    </div>
    </ToastProvider>
  );
}

function NavDrawer({
  open,
  onClose,
  items,
  pathname,
  signedIn,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  items: { href: string; label: string }[];
  pathname: string;
  signedIn: boolean;
  onLogout: () => void;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-label="Navigation menu"
        aria-modal="true"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-slate-950 shadow-2xl transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-emerald-950">QBuild</span>
            <span className="text-slate-400">Menu</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-200 hover:bg-white/10"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {items.map((n) => {
            const active = pathname === n.href || (n.href !== "/build" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onClose}
                className={`block rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-emerald-500/15 text-emerald-200" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        {signedIn && (
          <div className="border-t border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-rose-500/10 hover:text-rose-200"
            >
              Log out
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function FloatingCoachLauncher() {
  const [open, setOpen] = useState(false);

  // Lazy-load the chat only when the user opens the modal so the
  // import + Anthropic call don't run on every page load.
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI coach"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500 px-5 text-sm font-bold text-emerald-950 shadow-2xl shadow-emerald-500/20 transition hover:bg-emerald-400"
      >
        <span className="text-base">🤖</span>
        <span>AI coach</span>
      </button>
      {open && <CoachModal onClose={() => setOpen(false)} />}
    </>
  );
}

function CoachModal({ onClose }: { onClose: () => void }) {
  // We need AiCoachChat lazily — but lazy() can't be used here without
  // Suspense boundary. Pull it directly; the import cost only fires
  // when the modal mounts (the launcher button itself imports nothing).
  const [Chat, setChat] = useState<React.ComponentType<{ height?: number }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    import("./AiCoachChat").then((mod) => {
      if (!cancelled) setChat(() => mod.AiCoachChat);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 p-4 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800"
        >
          ×
        </button>
        {Chat ? <Chat height={560} /> : (
          <div className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-8 text-center text-sm text-slate-400">
            Loading coach…
          </div>
        )}
      </div>
    </div>
  );
}

function PlanBadge() {
  const token = useBuildAuth((s) => s.token);
  const [planKey, setPlanKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPlanKey(null);
      return;
    }
    let cancelled = false;
    buildApi
      .myUsage()
      .then((r) => {
        if (!cancelled) setPlanKey(r.plan.key);
      })
      .catch(() => {
        if (!cancelled) setPlanKey("FREE");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!planKey) return null;
  const tone =
    planKey === "PRO"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
      : planKey === "AGENCY"
        ? "bg-amber-500/20 text-amber-200 border-amber-500/30"
        : planKey === "PPHIRE"
          ? "bg-sky-500/20 text-sky-200 border-sky-500/30"
          : "bg-white/5 text-slate-300 border-white/10";
  return (
    <Link
      href="/build/pricing"
      className={`hidden items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${tone}`}
      title="Your current plan — click to compare or upgrade"
    >
      {planKey === "PPHIRE" ? "Pay-per-Hire" : planKey}
    </Link>
  );
}

function TierBadge() {
  const token = useBuildAuth((s) => s.token);
  const [tier, setTier] = useState<{ key: string; label: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setTier(null);
      return;
    }
    let cancelled = false;
    buildApi
      .loyaltyMe()
      .then((r) => {
        if (!cancelled && r.tier) setTier({ key: r.tier.key, label: r.tier.label });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Hide on Default — most users start there, the chip would just be noise.
  if (!tier || tier.key === "DEFAULT") return null;
  const theme = TIER_CHIP[tier.key] ?? TIER_CHIP.DEFAULT;
  return (
    <Link
      href="/build/loyalty"
      title={`AEV Loyalty · ${tier.label} tier`}
      className={`hidden items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${theme.className}`}
    >
      <span aria-hidden>{theme.emoji}</span>
      <span>{tier.label}</span>
    </Link>
  );
}

function NotificationBell() {
  const token = useBuildAuth((s) => s.token);
  const [summary, setSummary] = useState<{
    unreadMessages: number;
    pendingApplications: number;
    applicationUpdates: number;
    total: number;
  } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const tick = () => {
      buildApi
        .notifySummary()
        .then((r) => {
          if (!cancelled) setSummary(r);
        })
        .catch(() => {});
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [token]);

  const total = summary?.total ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={total > 0 ? `${total} new notifications` : "Notifications"}
        className="relative rounded-md border border-white/10 px-2.5 py-1.5 text-slate-200 hover:bg-white/10"
      >
        <span aria-hidden>🔔</span>
        {total > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-emerald-950">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm shadow-xl"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</span>
            <Link href="/build/notifications" onClick={() => setOpen(false)} className="text-[10px] text-emerald-300 hover:underline">See all →</Link>
          </div>
          {!summary ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : total === 0 ? (
            <p className="text-xs text-slate-500">All caught up.</p>
          ) : (
            <ul className="space-y-1.5">
              {summary.unreadMessages > 0 && (
                <li>
                  <Link
                    href="/build/messages"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/5"
                  >
                    <span>Unread messages</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 text-xs text-emerald-200">
                      {summary.unreadMessages}
                    </span>
                  </Link>
                </li>
              )}
              {summary.pendingApplications > 0 && (
                <li>
                  <Link
                    href="/build"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/5"
                  >
                    <span>Pending applications</span>
                    <span className="rounded-full bg-amber-500/20 px-2 text-xs text-amber-200">
                      {summary.pendingApplications}
                    </span>
                  </Link>
                </li>
              )}
              {summary.applicationUpdates > 0 && (
                <li>
                  <Link
                    href="/build/notifications"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-white/5"
                  >
                    <span>My application updates</span>
                    <span className="rounded-full bg-sky-500/20 px-2 text-xs text-sky-200">
                      {summary.applicationUpdates}
                    </span>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const hydrated = useBuildAuth((s) => s.hydrated);
  const token = useBuildAuth((s) => s.token);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !hydrated) {
    return <p className="py-8 text-sm text-slate-400">Loading…</p>;
  }
  if (!token) {
    return <SignInPanel />;
  }
  return <>{children}</>;
}

export function SignInPanel() {
  const setSession = useBuildAuth((s) => s.setSession);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r =
        mode === "login"
          ? await buildLogin(email.trim(), password)
          : await buildRegister(email.trim(), password, name.trim());
      setSession(r.token, r.user);
    } catch (e) {
      const err = e as BuildApiError;
      setError(err.payload && typeof err.payload === "object" && "details" in err.payload
        ? String((err.payload as { details: unknown }).details)
        : err.code || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {mode === "login" ? "Sign in" : "Create account"}
        </h2>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="text-xs text-slate-400 underline-offset-2 hover:underline"
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
      </div>
      <form onSubmit={submit} className="space-y-3 text-sm">
        {mode === "register" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            minLength={2}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          required
          minLength={6}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
        />
        {error && <p className="text-rose-300">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-3 text-xs text-slate-500">
        Single AEVION account — works across QBuild, QRight, QSign and other modules.
      </p>
    </div>
  );
}
