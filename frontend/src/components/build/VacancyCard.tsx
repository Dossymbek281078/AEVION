"use client";

import { useState } from "react";
import Link from "next/link";
import type { BuildVacancy } from "@/lib/build/api";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { BookmarkButton } from "./BookmarkButton";
import { deriveApplySource, deriveReferrerUserId } from "@/lib/build/applySource";

type CardTheme = "dark" | "light";

// Светлый «газетный» скин — opt-in. Дефолт тёмный, т.к. карточка ещё
// используется на непеределанной /build/project/[id].
const CARD_SKIN: Record<CardTheme, {
  closed: string; featured: string; normal: string;
  title: string; sub: string; salary: string; cur: string; muted: string;
  desc: string; meta: string; applied: string; applyBtn: string;
  badgeFeatured: string; badgeUrgent: string; badgeHot: string;
  pillCrit: string; pillWarn: string; pillSoft: string;
}> = {
  dark: {
    closed: "border-white/5 bg-white/[0.02] opacity-60",
    featured: "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10",
    normal: "border-white/10 bg-white/5 hover:border-emerald-500/30 hover:bg-white/10",
    title: "text-white group-hover:text-emerald-200",
    sub: "text-slate-400",
    salary: "text-emerald-300",
    cur: "text-slate-400",
    muted: "text-slate-500",
    desc: "text-slate-300",
    meta: "text-slate-400",
    applied: "text-emerald-300",
    applyBtn: "bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30",
    badgeFeatured: "bg-amber-500/20 text-amber-200",
    badgeUrgent: "border-red-400/60 bg-red-500/20 text-red-200",
    badgeHot: "border-rose-400/40 bg-rose-500/15 text-rose-200",
    pillCrit: "bg-rose-500/20 text-rose-200",
    pillWarn: "bg-amber-500/20 text-amber-200",
    pillSoft: "bg-amber-500/10 text-amber-300",
  },
  light: {
    closed: "border-[#e4e3dd] bg-[#f2f1ec] opacity-60",
    featured: "border-[#b7791f]/50 bg-[#b7791f]/[0.07] hover:border-[#b7791f]",
    normal: "border-[#d4d3cc] bg-white hover:border-[#0a7d72]",
    title: "text-[#17181a] group-hover:text-[#075b53]",
    sub: "text-[#74767c]",
    salary: "text-[#075b53]",
    cur: "text-[#74767c]",
    muted: "text-[#74767c]",
    desc: "text-[#45474c]",
    meta: "text-[#74767c]",
    applied: "text-[#075b53]",
    applyBtn: "bg-[#0a7d72] text-white hover:bg-[#075b53]",
    badgeFeatured: "bg-[#b7791f]/15 text-[#8a5a12]",
    badgeUrgent: "border-[#b5241b]/50 bg-[#b5241b]/10 text-[#b5241b]",
    badgeHot: "border-[#c2410c]/40 bg-[#c2410c]/10 text-[#9a3412]",
    pillCrit: "bg-[#b5241b]/12 text-[#b5241b]",
    pillWarn: "bg-[#b7791f]/15 text-[#8a5a12]",
    pillSoft: "bg-[#b7791f]/10 text-[#8a5a12]",
  },
};

export function VacancyCard({
  vacancy,
  showProject = false,
  hot = false,
  footerAction,
  theme = "dark",
}: {
  vacancy: BuildVacancy;
  showProject?: boolean;
  hot?: boolean;
  /** Optional control (e.g. compare toggle) laid out in the footer's right side
   *  so it never overlaps the applicants counter the way an absolute overlay did. */
  footerAction?: React.ReactNode;
  theme?: CardTheme;
}) {
  const s = CARD_SKIN[theme];
  const token = useBuildAuth((s) => s.token);
  const me = useBuildAuth((s) => s.user);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);

  const isClosed = vacancy.status === "CLOSED";
  const isOwner = me?.id === vacancy.clientId;
  const isFeatured = !!vacancy.boostUntil && new Date(vacancy.boostUntil) > new Date();
  const isUrgent = !!(vacancy as {urgent?: boolean}).urgent &&
    (() => {
      const u = (vacancy as {urgentUntil?: string|null}).urgentUntil;
      return !u || new Date(u) > new Date();
    })();
  const hasQuestions = (vacancy.questions?.length ?? 0) > 0;
  const daysLeft = vacancy.expiresAt
    ? Math.ceil((new Date(vacancy.expiresAt).getTime() - Date.now()) / 86400000)
    : null;
  const expiringSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 7 && !isClosed;

  async function quickApply(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!token || applied || busy || isOwner) return;
    setBusy(true);
    try {
      await buildApi.applyVacancy({
        vacancyId: vacancy.id,
        sourceTag: deriveApplySource(),
        referredByUserId: deriveReferrerUserId(),
      });
      setApplied(true);
    } catch {
      // If has questions or already applied, navigate to full page
      window.location.href = `/build/vacancy/${encodeURIComponent(vacancy.id)}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Link
      href={`/build/vacancy/${encodeURIComponent(vacancy.id)}`}
      className={`group relative block rounded-xl border p-4 transition ${
        isClosed ? s.closed : isFeatured ? s.featured : s.normal
      }`}
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {isFeatured && (
          <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wider ${s.badgeFeatured}`}>
            ★ Featured
          </div>
        )}
        {isUrgent && !isClosed && (
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-wider animate-pulse ${s.badgeUrgent}`}
            title={(vacancy as {urgentNote?: string|null}).urgentNote ?? "Срочный найм"}
          >
            🚨 Срочно
          </div>
        )}
        {hot && !isClosed && (
          <div
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-wider ${s.badgeHot}`}
            title="Trending — high applicant interest right now"
          >
            🔥 Hot
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className={`truncate text-base font-semibold transition ${s.title}`}>
            {vacancy.title}
          </h4>
          {showProject && vacancy.projectTitle && (
            <p className={`mt-0.5 truncate text-xs ${s.sub}`}>
              {vacancy.projectTitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            {vacancy.salary > 0 ? (
              <div className={`text-sm font-bold ${s.salary}`}>
                {vacancy.salary.toLocaleString("ru-RU")}
                <span className={`ml-1 text-[11px] font-normal ${s.cur}`}>
                  {vacancy.salaryCurrency || "₽"}
                </span>
              </div>
            ) : (
              <div className={`text-xs ${s.muted}`}>по договору</div>
            )}
            {isClosed && <div className={`mt-0.5 text-[10px] uppercase ${s.muted}`}>закрыта</div>}
          </div>
          <BookmarkButton kind="VACANCY" targetId={vacancy.id} />
        </div>
      </div>
      <p className={`mt-2 line-clamp-2 text-sm ${s.desc}`}>{vacancy.description}</p>
      <div className={`mt-3 flex items-center justify-between gap-2 text-xs ${s.meta}`}>
        <span className="flex items-center gap-2">
          {new Date(vacancy.createdAt).toLocaleDateString()}
          {expiringSoon && (
            <span
              className={`rounded-full px-1.5 py-1 text-xs font-semibold ${
                daysLeft! <= 1 ? s.pillCrit : daysLeft! <= 3 ? s.pillWarn : s.pillSoft
              }`}
              title={`Closes ${new Date(vacancy.expiresAt!).toLocaleDateString()}`}
            >
              {daysLeft === 0 ? "ends today" : `${daysLeft}d left`}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {typeof vacancy.applicationsCount === "number" && (
            <span className="flex items-center gap-1">
              <span>👥</span>
              <span>{vacancy.applicationsCount} {
                vacancy.applicationsCount === 1 ? "отклик" :
                vacancy.applicationsCount < 5 ? "отклика" : "откликов"
              }</span>
            </span>
          )}
          {footerAction}
        </span>
      </div>

      {token && !isOwner && !isClosed && (
        <div className="mt-3 flex items-center gap-2" onClick={(e) => e.preventDefault()}>
          {applied ? (
            <span className={`text-xs font-semibold ${s.applied}`}>✓ Applied</span>
          ) : hasQuestions ? (
            <Link
              href={`/build/vacancy/${encodeURIComponent(vacancy.id)}`}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${s.applyBtn}`}
            >
              Apply →
            </Link>
          ) : (
            <button
              onClick={quickApply}
              disabled={busy}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${s.applyBtn}`}
            >
              {busy ? "…" : "Quick apply"}
            </button>
          )}
        </div>
      )}
    </Link>
  );
}
