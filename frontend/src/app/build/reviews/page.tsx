"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildReview, type ReviewEligibilityRow } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={sz}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= rating ? "text-yellow-400" : "text-slate-600"}>★</span>
      ))}
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className={`text-2xl transition ${(hover || value) >= s ? "text-yellow-400" : "text-slate-600 hover:text-yellow-200"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <Body />
      </RequireAuth>
    </BuildShell>
  );
}

function Body() {
  const me = useBuildAuth((s) => s.user);
  const [received, setReceived] = useState<BuildReview[]>([]);
  const [eligible, setEligible] = useState<ReviewEligibilityRow[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"received" | "give">("received");

  async function load() {
    if (!me?.id) return;
    setLoading(true);
    try {
      const [rev, elig] = await Promise.all([
        buildApi.reviewsByUser(me.id),
        buildApi.eligibleReviews(),
      ]);
      setReceived(rev.items);
      setAvgRating(rev.avgRating ?? 0);
      setEligible(elig.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [me?.id]);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reviews</h1>
          {received.length > 0 && (
            <div className="mt-1 flex items-center gap-2">
              <Stars rating={Math.round(avgRating)} size="sm" />
              <span className="text-sm text-slate-400">
                {avgRating.toFixed(1)} · {received.length} review{received.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mb-5 flex gap-1">
        {(["received", "give"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-emerald-500/20 text-emerald-200"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {t === "received" ? `Received (${received.length})` : `Give review (${eligible.length})`}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && tab === "received" && (
        <>
          {received.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-slate-400">No reviews yet. Complete a project to get your first review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {received.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && tab === "give" && (
        <>
          {eligible.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-slate-400">
                No pending reviews. Reviews become available after a project application is accepted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {eligible.map((e) => (
                <EligibleCard key={`${e.projectId}-${e.revieweeId}`} row={e} onDone={load} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: BuildReview }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Stars rating={review.rating} />
            <span className="text-xs text-slate-400">
              from {review.reviewerName || "Anonymous"}
            </span>
          </div>
          {review.projectTitle && (
            <div className="mt-0.5 text-xs text-slate-500">
              Project: {review.projectTitle}
            </div>
          )}
          {review.comment && (
            <p className="mt-2 text-sm text-slate-300 italic">&ldquo;{review.comment}&rdquo;</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-slate-500">
          {new Date(review.createdAt).toLocaleDateString("ru-RU")}
        </span>
      </div>
    </div>
  );
}

function EligibleCard({ row, onDone }: { row: ReviewEligibilityRow; onDone: () => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await buildApi.createReview({
        projectId: row.projectId,
        revieweeId: row.revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });
      setDone(true);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
        ✅ Review submitted for {row.revieweeName || "user"}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-3">
        <div className="font-semibold text-white">
          Leave a review for{" "}
          <Link href={`/build/u/${encodeURIComponent(row.revieweeId)}`} className="text-emerald-300 hover:underline">
            {row.revieweeName || "user"}
          </Link>
        </div>
        <div className="text-xs text-slate-400">
          Project: {row.projectTitle || row.projectId.slice(0, 8)} ·{" "}
          <span className="capitalize">{row.direction.toLowerCase().replace("_", " → ")}</span>
        </div>
      </div>
      <StarPicker value={rating} onChange={setRating} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment (max 2000 chars)…"
        rows={3}
        maxLength={2000}
        className="mt-3 w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
      />
      {error && (
        <p className="mt-2 rounded-md bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200">{error}</p>
      )}
      <button
        onClick={submit}
        disabled={busy || rating === 0}
        className="mt-3 rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </div>
  );
}
