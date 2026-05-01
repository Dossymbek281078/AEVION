"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildApi, type BuildReview } from "@/lib/build/api";
import { StarsDisplay, StarsInput } from "./StarRating";

// ── Public list of reviews about a single user ─────────────────────
// Reads /api/build/reviews/by-user/:userId and renders a card list.
// Suitable for /build/u/[id] or /build/p/[id]'s "client reviews" tab.
export function ReviewsByUserSection({
  userId,
  initialAvg,
  initialCount,
  emptyHint = "Пока нет отзывов о этом пользователе.",
}: {
  userId: string;
  initialAvg?: number;
  initialCount?: number;
  emptyHint?: string;
}) {
  const [items, setItems] = useState<BuildReview[]>([]);
  const [avg, setAvg] = useState<number>(initialAvg ?? 0);
  const [count, setCount] = useState<number>(initialCount ?? 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    buildApi
      .reviewsByUser(userId, 50, 0)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setAvg(r.avgRating);
        setCount(r.total);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Reviews
        </h2>
        {count > 0 && (
          <StarsDisplay value={avg} size="md" showValue reviewCount={count} />
        )}
      </div>

      {loading && <p className="text-xs text-slate-500">Loading…</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">{emptyHint}</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Reviews scoped to a single project ─────────────────────────────
// Both directions, in chronological order. Used inside /build/project/[id].
export function ReviewsByProjectSection({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<BuildReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildApi
      .reviewsByProject(projectId)
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [projectId, reload]);

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Reviews on this project
        </h2>
        <button
          onClick={() => setReload((n) => n + 1)}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
        >
          ↻ refresh
        </button>
      </div>

      {loading && <p className="text-xs text-slate-500">Loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500">
          Пока никто не оставлял отзывов на этом проекте. После завершения вакансии у обеих сторон появится возможность оценить друг друга.
        </p>
      )}
      {!loading && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((r) => (
            <ReviewCard key={r.id} review={r} showDirection />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReviewCard({
  review,
  showDirection = false,
}: {
  review: BuildReview;
  showDirection?: boolean;
}) {
  const directionLabel =
    review.direction === "CLIENT_TO_WORKER" ? "Client → Worker" : "Worker → Client";
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarsDisplay value={review.rating} size="md" />
          {review.reviewerName && (
            <Link
              href={`/build/u/${review.reviewerId}`}
              className="text-sm font-semibold text-slate-200 hover:underline"
            >
              {review.reviewerName}
            </Link>
          )}
          {review.projectTitle && (
            <span className="text-xs text-slate-500">
              · on{" "}
              <Link
                href={`/build/project/${review.projectId}`}
                className="hover:underline"
              >
                {review.projectTitle}
              </Link>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          {showDirection && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 uppercase tracking-wider">
              {directionLabel}
            </span>
          )}
          <span>{new Date(review.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      {review.comment && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
          {review.comment}
        </p>
      )}
    </li>
  );
}

// ── Review composition form ────────────────────────────────────────
// Renders all eligible (project, reviewee) pairs for the current user
// and lets them post a review per pair. After a successful post the
// row drops out of the eligible list (server-side filter), so the form
// "shrinks" until empty.
export function EligibleReviewsBlock({
  scopeProjectId,
  onPosted,
}: {
  scopeProjectId?: string;
  onPosted?: () => void;
}) {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof buildApi.eligibleReviews>>["items"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildApi
      .eligibleReviews()
      .then((r) => {
        if (cancelled) return;
        const filtered = scopeProjectId
          ? r.items.filter((it) => it.projectId === scopeProjectId)
          : r.items;
        setItems(filtered);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scopeProjectId, reload]);

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <section className="mt-6 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900 p-6">
      <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
        Leave a review
      </div>
      <h2 className="mt-1 text-lg font-bold text-white">
        У вас {items.length} pending {items.length === 1 ? "review" : "reviews"}
      </h2>
      <p className="mt-1 text-xs text-amber-200/70">
        Оценка обеих сторон делает рейтинг честным — это и есть наш main differentiator от HH.
      </p>
      <div className="mt-4 space-y-3">
        {items.map((it) => (
          <SingleReviewForm
            key={`${it.projectId}-${it.revieweeId}`}
            row={it}
            onSubmitted={() => {
              setReload((n) => n + 1);
              onPosted?.();
            }}
          />
        ))}
      </div>
    </section>
  );
}

function SingleReviewForm({
  row,
  onSubmitted,
}: {
  row: { projectId: string; projectTitle: string | null; revieweeId: string; revieweeName: string | null; direction: "CLIENT_TO_WORKER" | "WORKER_TO_CLIENT" };
  onSubmitted: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!rating) {
      setError("Выберите рейтинг от 1 до 5 звёзд.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await buildApi.submitReview({
        projectId: row.projectId,
        revieweeId: row.revieweeId,
        rating,
        comment: comment.trim() || null,
      });
      onSubmitted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm">
          <span className="text-slate-400">Reviewing </span>
          <Link
            href={`/build/u/${row.revieweeId}`}
            className="font-semibold text-white hover:underline"
          >
            {row.revieweeName ?? row.revieweeId.slice(0, 8)}
          </Link>
          {row.projectTitle && (
            <span className="text-slate-500">
              {" "}
              · on{" "}
              <Link href={`/build/project/${row.projectId}`} className="hover:underline">
                {row.projectTitle}
              </Link>
            </span>
          )}
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">
          {row.direction === "CLIENT_TO_WORKER" ? "as client" : "as worker"}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <StarsInput value={rating} onChange={setRating} size="lg" disabled={busy} />
        <span className="text-xs text-slate-400">{rating}/5</span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Что было хорошо и что можно улучшить?"
        rows={3}
        maxLength={2000}
        disabled={busy}
        className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
      />

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={busy || rating < 1}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? "…" : "Post review"}
        </button>
      </div>
    </div>
  );
}
