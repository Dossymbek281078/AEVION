"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useI18n } from "@/lib/i18n";

type Interview = {
  id: string;
  applicationId: string;
  vacancyId: string;
  recruiterId: string;
  candidateId: string;
  title: string;
  proposedSlots: string[];
  confirmedSlot: string | null;
  format: string;
  location: string | null;
  notes: string | null;
  status: string;
  canceledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUS_BADGE: Record<string, { labelKey: string; cls: string }> = {
  PROPOSED:  { labelKey: "build.interviews.status.proposed",  cls: "bg-amber-900/40 text-amber-300 border-amber-700/40" },
  CONFIRMED: { labelKey: "build.interviews.status.confirmed", cls: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40" },
  CANCELED:  { labelKey: "build.interviews.status.canceled",  cls: "bg-slate-800 text-slate-500 border-slate-700" },
  COMPLETED: { labelKey: "build.interviews.status.completed", cls: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
};

const FORMAT_LABEL_KEYS: Record<string, string> = {
  video:     "build.interviews.format.video",
  phone:     "build.interviews.format.phone",
  in_person: "build.interviews.format.inPerson",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });
}

function InterviewCard({ interview, userId, onConfirm, onCancel, onComplete }: {
  interview: Interview;
  userId: string;
  onConfirm: (id: string, slot: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  onComplete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const isRecruiter = interview.recruiterId === userId;
  const isCandidate = interview.candidateId === userId;
  const badgeInfo = STATUS_BADGE[interview.status];
  const badge = badgeInfo
    ? { label: t(badgeInfo.labelKey), cls: badgeInfo.cls }
    : { label: interview.status, cls: "bg-slate-800 text-slate-400" };
  const formatKey = FORMAT_LABEL_KEYS[interview.format];
  const formatLabel = formatKey ? t(formatKey) : interview.format;
  const [acting, setActing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  async function handleConfirm() {
    if (!selectedSlot) return;
    setActing(true);
    try { await onConfirm(interview.id, selectedSlot); } finally { setActing(false); }
  }

  async function handleCancel() {
    if (!confirm(t("build.interviews.card.confirmCancel"))) return;
    setActing(true);
    try { await onCancel(interview.id); } finally { setActing(false); }
  }

  async function handleComplete() {
    setActing(true);
    try { await onComplete(interview.id); } finally { setActing(false); }
  }

  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 ${interview.status === "CANCELED" ? "opacity-60 border-slate-800" : "border-slate-700"}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-bold text-white">{interview.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
            <span className="text-xs text-slate-500">{formatLabel}</span>
            {isRecruiter && <span className="text-xs text-violet-400">{t("build.interviews.card.recruiterTag")}</span>}
            {isCandidate && !isRecruiter && <span className="text-xs text-teal-400">{t("build.interviews.card.candidateTag")}</span>}
          </div>
        </div>
      </div>

      {/* Confirmed slot */}
      {interview.confirmedSlot && (
        <div className="bg-emerald-900/20 border border-emerald-800/40 rounded-xl px-4 py-2 mb-3">
          <p className="text-xs text-emerald-400 font-semibold">{t("build.interviews.card.confirmedTime")}</p>
          <p className="text-sm text-white font-bold mt-0.5">{fmtDate(interview.confirmedSlot)}</p>
          {interview.location && <p className="text-xs text-emerald-400 mt-0.5">📍 {interview.location}</p>}
        </div>
      )}

      {/* Proposed slots for candidate to choose */}
      {interview.status === "PROPOSED" && isCandidate && (
        <div className="mb-3">
          <p className="text-xs text-slate-400 mb-2">{t("build.interviews.card.chooseTime")}</p>
          <div className="space-y-1.5">
            {interview.proposedSlots.map((slot) => (
              <button
                key={slot}
                onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                  selectedSlot === slot
                    ? "bg-teal-600 border-teal-500 text-white"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {fmtDate(slot)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recruiter shows proposed slots */}
      {interview.status === "PROPOSED" && isRecruiter && !interview.confirmedSlot && (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">{t("build.interviews.card.proposedSlots")}</p>
          <div className="flex gap-2 flex-wrap">
            {interview.proposedSlots.map((slot) => (
              <span key={slot} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-lg">
                {fmtDate(slot)}
              </span>
            ))}
          </div>
        </div>
      )}

      {interview.notes && (
        <p className="text-xs text-slate-400 mb-3 italic">{interview.notes}</p>
      )}

      {interview.status === "CANCELED" && interview.cancelReason && (
        <p className="text-xs text-slate-500 mb-3">{t("build.interviews.card.cancelReason", { reason: interview.cancelReason })}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {interview.status === "PROPOSED" && isCandidate && selectedSlot && (
          <button
            onClick={handleConfirm}
            disabled={acting}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {acting ? "…" : t("build.interviews.card.confirmSlotBtn")}
          </button>
        )}
        {interview.status === "CONFIRMED" && isRecruiter && (
          <button
            onClick={handleComplete}
            disabled={acting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {acting ? "…" : t("build.interviews.card.completeBtn")}
          </button>
        )}
        {(interview.status === "PROPOSED" || interview.status === "CONFIRMED") && (
          <button
            onClick={handleCancel}
            disabled={acting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-400 text-sm font-semibold rounded-xl transition-colors"
          >
            {acting ? "…" : t("build.interviews.card.cancelBtn")}
          </button>
        )}
        <Link
          href={`/build/vacancy/${interview.vacancyId}`}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors"
        >
          {t("build.interviews.card.vacancyLink")}
        </Link>
      </div>

      <p className="text-xs text-slate-600 mt-3">{fmtDate(interview.createdAt)} · ID {interview.id.slice(0, 8)}</p>
    </div>
  );
}

type FilterTab = "all" | "upcoming" | "pending" | "past";

const TAB_LABEL_KEYS: Record<FilterTab, string> = {
  all: "build.interviews.tabs.all",
  pending: "build.interviews.tabs.pending",
  upcoming: "build.interviews.tabs.upcoming",
  past: "build.interviews.tabs.past",
};

const TAB_ORDER: readonly FilterTab[] = ["all", "pending", "upcoming", "past"];

function InterviewsContent() {
  const { t } = useI18n();
  const user = useBuildAuth((s) => s.user);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.myScheduledInterviews();
      setInterviews(r.interviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("build.interviews.page.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleConfirm(id: string, slot: string) {
    await buildApi.confirmInterview(id, slot);
    await load();
  }

  async function handleCancel(id: string) {
    await buildApi.cancelInterview(id);
    await load();
  }

  async function handleComplete(id: string) {
    await buildApi.completeInterview(id);
    await load();
  }

  const now = new Date();

  const filtered = interviews.filter((i) => {
    if (tab === "pending") return i.status === "PROPOSED";
    if (tab === "upcoming") return i.status === "CONFIRMED" && i.confirmedSlot && new Date(i.confirmedSlot) > now;
    if (tab === "past") return i.status === "COMPLETED" || i.status === "CANCELED" || (i.status === "CONFIRMED" && i.confirmedSlot && new Date(i.confirmedSlot) <= now);
    return true;
  });

  const counts = {
    all: interviews.length,
    pending: interviews.filter((i) => i.status === "PROPOSED").length,
    upcoming: interviews.filter((i) => i.status === "CONFIRMED" && i.confirmedSlot && new Date(i.confirmedSlot) > now).length,
    past: interviews.filter((i) => i.status === "COMPLETED" || i.status === "CANCELED").length,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{t("build.interviews.page.title")}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t("build.interviews.page.totalCount", { count: interviews.length })}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 p-1 rounded-xl mb-6 border border-slate-800">
        {TAB_ORDER.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === tabKey ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t(TAB_LABEL_KEYS[tabKey])}
            {counts[tabKey] > 0 && <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${tab === tabKey ? "bg-slate-600" : "bg-slate-800"}`}>{counts[tabKey]}</span>}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-slate-500 text-sm animate-pulse">{t("build.interviews.page.loading")}</div>}
      {error && <div className="bg-red-900/30 border border-red-800 rounded-xl px-4 py-3 text-sm text-red-300">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-sm">
            {tab === "pending" ? t("build.interviews.empty.pending") :
             tab === "upcoming" ? t("build.interviews.empty.upcoming") :
             tab === "past" ? t("build.interviews.empty.past") :
             t("build.interviews.empty.default")}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map((i) => (
          <InterviewCard
            key={i.id}
            interview={i}
            userId={user?.id ?? ""}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            onComplete={handleComplete}
          />
        ))}
      </div>
    </div>
  );
}

export default function InterviewsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <InterviewsContent />
      </RequireAuth>
    </BuildShell>
  );
}
