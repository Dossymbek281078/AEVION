"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export default function SettingsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const user = useBuildAuth((s) => s.user);
  const logout = useBuildAuth((s) => s.logout);
  const [sub, setSub] = useState<Awaited<ReturnType<typeof buildApi.mySubscription>> | null>(null);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof buildApi.myOrders>> | null>(null);

  useEffect(() => {
    buildApi.mySubscription().then(setSub).catch(() => {});
    buildApi.myOrders().then(setOrders).catch(() => {});
  }, []);

  return (
    <div className="max-w-xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-white">Account settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account, plan, and security.
        </p>
      </header>

      <Section title="Account">
        <Row label="Email" value={user?.email ?? "—"} />
        <Row label="Name" value={user?.name ?? "—"} />
        <Row label="Role" value={user?.role ?? "—"} />
        <div className="pt-2">
          <Link
            href="/build/profile"
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          >
            Edit public profile →
          </Link>
        </div>
      </Section>

      <ChangePasswordForm />

      <Section title="Subscription">
        {sub === null ? (
          <p className="text-xs text-slate-400">Loading…</p>
        ) : sub.subscription ? (
          <>
            <Row label="Plan" value={sub.subscription.planKey} />
            <Row label="Status" value={sub.subscription.status} />
            {sub.subscription.endsAt && (
              <Row
                label="Expires"
                value={new Date(sub.subscription.endsAt).toLocaleDateString("ru-RU")}
              />
            )}
            <div className="pt-2">
              <Link
                href="/build/pricing"
                className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              >
                Compare plans →
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">Free plan (no active subscription)</p>
            <div className="pt-2">
              <Link
                href="/build/pricing"
                className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
              >
                Upgrade →
              </Link>
            </div>
          </>
        )}
      </Section>

      {orders && orders.items.length > 0 && (
        <Section title="Order history">
          <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-slate-400">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.items.map((o) => (
                  <tr key={o.id} className="text-slate-200">
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(o.createdAt).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-3 py-2">{o.kind}</td>
                    <td className="px-3 py-2">
                      {o.amount > 0 ? `${o.amount.toLocaleString("ru-RU")} ${o.currency}` : "—"}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${
                      o.status === "PAID" ? "text-emerald-300" :
                      o.status === "PENDING" ? "text-amber-300" : "text-slate-400"
                    }`}>
                      {o.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link
            href="/build/pricing"
            className="mt-2 inline-block text-xs text-emerald-300 hover:underline"
          >
            Manage billing →
          </Link>
        </Section>
      )}

      <Section title="Danger zone">
        <p className="text-xs text-slate-400">
          Signing out will clear your session. Your data and profile remain intact.
        </p>
        <div className="pt-2">
          <button
            onClick={logout}
            className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            Sign out
          </button>
        </div>
      </Section>
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    if (next.length < 8) {
      setMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await buildApi.changePassword(current, next);
      setMsg({ ok: true, text: "Password changed successfully." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      const err = e as Error;
      setMsg({
        ok: false,
        text: err.message.includes("current_password_incorrect")
          ? "Current password is incorrect."
          : err.message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">Change password</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Current password"
          type="password"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
        />
        <Field
          label="New password"
          type="password"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
        />
        <Field
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        {msg && (
          <p className={`rounded-md px-3 py-2 text-xs ${
            msg.ok
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
          }`}>
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !current || !next || !confirm}
          className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}
