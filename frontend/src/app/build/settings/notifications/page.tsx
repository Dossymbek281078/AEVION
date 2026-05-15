"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { useToast } from "@/components/build/Toast";
import { buildApi } from "@/lib/build/api";

type Prefs = {
  jobAlerts: boolean;
  applicationEmail: boolean;
  weeklyDigest: boolean;
  marketing: boolean;
};

const ITEMS: { key: keyof Prefs; title: string; desc: string }[] = [
  {
    key: "jobAlerts",
    title: "Vacancy alerts",
    desc: "Email when a new vacancy matches your saved keywords / skills / city.",
  },
  {
    key: "applicationEmail",
    title: "New applications (recruiters)",
    desc: "Email when a candidate applies to one of your open vacancies.",
  },
  {
    key: "weeklyDigest",
    title: "Weekly digest",
    desc: "Sunday summary: pending applications, expiring vacancies, top matches.",
  },
  {
    key: "marketing",
    title: "Product updates",
    desc: "Major launches and feature announcements.",
  },
];

export default function NotificationSettingsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .getNotificationPrefs()
      .then((p) => {
        if (cancelled) return;
        setPrefs({
          jobAlerts: p.jobAlerts,
          applicationEmail: p.applicationEmail,
          weeklyDigest: p.weeklyDigest,
          marketing: p.marketing,
        });
      })
      .catch((e) => {
        if (!cancelled) setErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs || busy) return;
    const next = { ...prefs, [key]: !prefs[key] };
    const previous = prefs;
    setPrefs(next);
    setBusy(true);
    try {
      await buildApi.setNotificationPrefs({ [key]: next[key] });
      toast.success(`${ITEMS.find((i) => i.key === key)?.title} ${next[key] ? "enabled" : "disabled"}`);
    } catch (e) {
      setPrefs(previous);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/build/settings"
        className="text-xs text-slate-400 underline-offset-2 hover:underline"
      >
        ← Settings
      </Link>
      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold text-white">Notification preferences</h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose what QBuild emails you want to receive. You can re-enable any of these later.
        </p>
      </div>

      {err && (
        <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {err}
        </div>
      )}

      {!prefs && !err && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-slate-400">
          Loading…
        </div>
      )}

      {prefs && (
        <div className="space-y-3">
          {ITEMS.map((item) => (
            <div
              key={item.key}
              className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">{item.desc}</div>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                disabled={busy}
                role="switch"
                aria-checked={prefs[item.key]}
                aria-label={`Toggle ${item.title}`}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
                  prefs[item.key] ? "bg-emerald-500" : "bg-slate-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    prefs[item.key] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-5 text-xs text-slate-400">
        <div className="mb-1 font-semibold text-slate-300">Vacancy alerts override</div>
        <p>
          Vacancy alerts are also configurable in your{" "}
          <Link href="/build/profile" className="text-emerald-300 underline">
            profile
          </Link>{" "}
          (keywords, skills, city). Toggling Vacancy alerts off here is a global mute that
          overrides every saved alert.
        </p>
      </div>
    </div>
  );
}
