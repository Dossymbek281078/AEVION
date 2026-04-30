"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useBuildAuth } from "@/lib/build/auth";
import { buildApi, buildLogin, buildRegister, BuildApiError } from "@/lib/build/api";

const NAV: { href: string; label: string }[] = [
  { href: "/build", label: "Projects" },
  { href: "/build/vacancies", label: "Vacancies" },
  { href: "/build/create-project", label: "New project" },
  { href: "/build/profile", label: "Profile" },
  { href: "/build/messages", label: "Messages" },
];

export function BuildShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useBuildAuth((s) => s.user);
  const logout = useBuildAuth((s) => s.logout);
  const hydrated = useBuildAuth((s) => s.hydrated);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/build" className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <span className="rounded-md bg-emerald-500 px-2 py-0.5 text-emerald-950">QBuild</span>
            <span className="text-slate-400">AEVION Construction & Recruiting</span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((n) => {
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
          </nav>

          <div className="flex items-center gap-2 text-xs">
            {hydrated && user ? (
              <>
                <NotificationBell />
                <span className="hidden text-slate-400 sm:inline">{user.email}</span>
                <button
                  onClick={logout}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-slate-200 hover:bg-white/10"
                >
                  Sign out
                </button>
              </>
            ) : (
              <span className="text-slate-500">Not signed in</span>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/5 px-4 py-2 sm:hidden">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/build" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs ${
                  active ? "bg-white/10 text-white" : "text-slate-400"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
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
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Notifications
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
                    href="/build/profile"
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
