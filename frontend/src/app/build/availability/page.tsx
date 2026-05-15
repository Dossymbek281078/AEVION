"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";

export default function AvailabilityPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availableUntil, setAvailableUntil] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // For the "available until" picker — hours from now
  const [hoursInput, setHoursInput] = useState("8");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await buildApi.myAvailability();
      setAvailable(r.availableNow ?? r.available ?? false);
      setAvailableUntil(r.availableUntil ?? null);
      setSkills(r.skills ?? []);
      setCity(r.city ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(toAvailable: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const hours = toAvailable ? parseInt(hoursInput, 10) || 8 : undefined;
      const r = await buildApi.setAvailability(toAvailable, hours);
      setAvailable(r.availableNow ?? toAvailable);
      setAvailableUntil(r.availableUntil ?? null);
      setSuccess(
        toAvailable
          ? `Status set to Available${r.availableUntil ? " until " + new Date(r.availableUntil).toLocaleString() : ""}.`
          : "Status set to Unavailable.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isAvailableNow = available === true;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Availability</h1>
          <p className="mt-1 text-sm text-slate-400">
            Let employers find you when you are ready to take work.
          </p>
        </div>
        <Link
          href="/build/profile"
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:bg-white/10"
        >
          ← Profile
        </Link>
      </header>

      {error && (
        <p className="mb-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {success}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Status card */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-3 w-3 rounded-full ${
                    isAvailableNow ? "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" : "bg-slate-600"
                  }`}
                  aria-hidden
                />
                <div>
                  <p className="text-base font-semibold text-white">
                    {isAvailableNow ? "Available now" : "Not available"}
                  </p>
                  {isAvailableNow && availableUntil && (
                    <p className="text-xs text-slate-400">
                      Until{" "}
                      <span className="text-slate-200">
                        {new Date(availableUntil).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {(skills.length > 0 || city) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {[city, skills.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              <span
                className={`self-start rounded-full border px-3 py-1 text-xs font-semibold sm:self-auto ${
                  isAvailableNow
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-slate-600/50 bg-slate-700/30 text-slate-400"
                }`}
              >
                {isAvailableNow ? "AVAILABLE" : "UNAVAILABLE"}
              </span>
            </div>
          </section>

          {/* Toggle controls */}
          {!isAvailableNow ? (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-300">Mark as available</h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400" htmlFor="hours-input">
                    Available for (hours)
                  </label>
                  <input
                    id="hours-input"
                    type="number"
                    min={1}
                    max={720}
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    className="w-28 rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => toggle(true)}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Set available"}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Your profile will appear in the "Available workers" list visible to employers.
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">End availability</h2>
              <button
                onClick={() => toggle(false)}
                disabled={saving}
                className="rounded-md border border-rose-500/30 bg-rose-500/10 px-5 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Mark as unavailable"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Your profile will be hidden from the available workers list.
              </p>
            </section>
          )}

          {/* Info panel */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-300">How it works</h2>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-400">•</span>
                When available, your profile appears in the real-time available workers list.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-400">•</span>
                Employers can filter by your skills and city to find you quickly.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-400">•</span>
                Availability expires automatically after the number of hours you set.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-emerald-400">•</span>
                You can extend or turn off availability at any time from this page.
              </li>
            </ul>
            <div className="mt-4">
              <Link
                href="/build/talent"
                className="text-xs text-emerald-400 hover:underline"
              >
                See available workers →
              </Link>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
