"use client";

import { useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export function ApplicationForm({
  vacancyId,
  alreadyApplied,
  onApplied,
}: {
  vacancyId: string;
  alreadyApplied?: boolean;
  onApplied?: () => void;
}) {
  const token = useBuildAuth((s) => s.token);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
        Sign in to apply for this vacancy.
      </div>
    );
  }

  if (alreadyApplied || success) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
        Application submitted. The project owner will review it shortly.
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await buildApi.apply({ vacancyId, message: message.trim() || undefined });
      setSuccess(true);
      onApplied?.();
    } catch (err) {
      const e = err as BuildApiError;
      setError(e.code === "already_applied" ? "You have already applied to this vacancy." : e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm font-medium text-slate-200">
        Cover note (optional)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={4000}
          placeholder="Briefly describe your experience for this role…"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}
