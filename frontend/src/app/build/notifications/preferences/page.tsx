"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

// ── types ────────────────────────────────────────────────────────────────────

type Prefs = {
  jobAlerts: boolean;
  applicationEmail: boolean;
  weeklyDigest: boolean;
  marketing: boolean;
};

type PrefKey = keyof Prefs;

type PrefMeta = {
  key: PrefKey;
  label: string;
  description: string;
};

// ── preference definitions ───────────────────────────────────────────────────

const PREF_META: PrefMeta[] = [
  {
    key: "jobAlerts",
    label: "Job Alerts",
    description:
      "Notify me when new vacancies matching my skills or saved searches are posted.",
  },
  {
    key: "applicationEmail",
    label: "Application Updates",
    description:
      "Send me an email when the status of my application changes (accepted, rejected, interview).",
  },
  {
    key: "weeklyDigest",
    label: "Weekly Digest",
    description:
      "A weekly summary of new projects, featured vacancies, and platform activity.",
  },
  {
    key: "marketing",
    label: "Tips & Product News",
    description:
      "Occasional tips on using QBuild, new feature announcements, and platform updates.",
  },
];

// ── page shell ───────────────────────────────────────────────────────────────

export default function NotificationPreferencesPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

// ── body ─────────────────────────────────────────────────────────────────────

function Body() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<PrefKey | null>(null);
  const [savedKey, setSavedKey] = useState<PrefKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await buildApi.getNotificationPrefs();
        if (!cancelled) {
          setPrefs({
            jobAlerts: data.jobAlerts,
            applicationEmail: data.applicationEmail,
            weeklyDigest: data.weeklyDigest,
            marketing: data.marketing,
          });
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── toggle ────────────────────────────────────────────────────────────────

  async function toggle(key: PrefKey) {
    if (!prefs || saving) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    setSaving(key);
    setError(null);
    try {
      const updated = await buildApi.setNotificationPrefs({ [key]: next[key] });
      setPrefs({
        jobAlerts: updated.jobAlerts,
        applicationEmail: updated.applicationEmail,
        weeklyDigest: updated.weeklyDigest,
        marketing: updated.marketing,
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey((prev) => (prev === key ? null : prev)), 1800);
    } catch (e) {
      setPrefs(prefs); // revert
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl">
      {/* header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
          <Link href="/build/notifications" className="hover:text-slate-300">
            Notifications
          </Link>
          <span>/</span>
          <span className="text-slate-300">Preferences</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Notification Preferences</h1>
        <p className="mt-1 text-sm text-slate-400">
          Choose which emails and alerts you want to receive from QBuild.
        </p>
      </div>

      {/* error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* skeleton */}
      {loading && (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-64 animate-pulse rounded bg-white/5" />
              </div>
              <div className="mt-0.5 h-5 w-9 animate-pulse rounded-full bg-white/10" />
            </div>
          ))}
        </div>
      )}

      {/* toggles */}
      {!loading && prefs && (
        <ul className="space-y-3">
          {PREF_META.map(({ key, label, description }) => {
            const enabled = prefs[key];
            const isSaving = saving === key;
            const justSaved = savedKey === key;

            return (
              <li
                key={key}
                className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.05]"
              >
                {/* text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    {justSaved && (
                      <span className="text-[10px] font-medium text-emerald-400">
                        Saved
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{description}</p>
                </div>

                {/* toggle */}
                <button
                  role="switch"
                  aria-checked={enabled}
                  aria-label={label}
                  disabled={isSaving}
                  onClick={() => toggle(key)}
                  className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-wait ${
                    enabled
                      ? "border-emerald-500/50 bg-emerald-500"
                      : "border-white/10 bg-white/10"
                  }`}
                >
                  <span
                    className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-150 ${
                      enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                    } ${isSaving ? "opacity-60" : ""}`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* push notifications link */}
      {!loading && (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3.5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Browser Push Notifications</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Receive instant alerts in your browser even when QBuild is not open.
              </p>
            </div>
            <Link
              href="/build/push/subscribe"
              className="shrink-0 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 transition"
            >
              Manage
            </Link>
          </div>
        </div>
      )}

      {/* back link */}
      <div className="mt-6">
        <Link href="/build/notifications" className="text-xs text-slate-500 hover:text-slate-300">
          ← Back to notifications
        </Link>
      </div>
    </div>
  );
}
