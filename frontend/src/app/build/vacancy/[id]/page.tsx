"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ApplicationForm } from "@/components/build/ApplicationForm";
import { QuickApplyButton } from "@/components/build/QuickApplyButton";
import { HelpTip } from "@/components/build/HelpTip";
import { TrialTaskBlock } from "@/components/build/TrialTaskBlock";
import {
  buildApi,
  type BuildVacancy,
  type BuildApplication,
  type ApplicationStatus,
  type TalentRow,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export default function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useBuildAuth((s) => s.user);

  const [vacancy, setVacancy] = useState<BuildVacancy | null>(null);
  const [applications, setApplications] = useState<BuildApplication[] | null>(null);
  const [myApplied, setMyApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    buildApi
      .getVacancy(id)
      .then(async (v) => {
        setVacancy(v);
        if (me?.id) {
          const isOwner = v.clientId === me.id;
          const [my, owned] = await Promise.all([
            buildApi.myApplications().catch(() => ({ items: [] as BuildApplication[], total: 0 })),
            isOwner
              ? buildApi.applicationsByVacancy(id).catch(() => ({ items: [] as BuildApplication[], total: 0 }))
              : Promise.resolve(null),
          ]);
          setMyApplied(my.items.some((a) => a.vacancyId === id));
          setApplications(owned ? owned.items : null);
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, me?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-slate-400">Loading vacancy…</p>
      </BuildShell>
    );
  }
  if (error || !vacancy) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-rose-300">{error || "Vacancy not found."}</p>
        <Link href="/build" className="text-sm text-emerald-300 underline">
          ← Back to projects
        </Link>
      </BuildShell>
    );
  }

  const isOwner = me?.id === vacancy.clientId;

  return (
    <BuildShell>
      <nav className="mb-3 flex items-center gap-2 text-xs text-slate-500">
        <Link href="/build/vacancies" className="hover:text-slate-300">Вакансии</Link>
        <span>›</span>
        <span className="text-slate-400 truncate max-w-xs">{vacancy.title}</span>
      </nav>

      <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                vacancy.status === "OPEN"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-slate-500/20 text-slate-400"
              }`}>
                {vacancy.status === "OPEN" ? "● Открыта" : "✕ Закрыта"}
              </span>
              {vacancy.city && (
                <span className="text-xs text-slate-400">📍 {vacancy.city}</span>
              )}
              <span className="text-xs text-slate-500">
                Опубликована {new Date(vacancy.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white">{vacancy.title}</h1>
            {vacancy.projectTitle && (
              <p className="mt-1 text-sm text-slate-400">
                Проект: <Link href={`/build/project/${encodeURIComponent(vacancy.projectId)}`} className="text-emerald-300 hover:underline">{vacancy.projectTitle}</Link>
              </p>
            )}
          </div>
          <div className="shrink-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3 text-center">
            <div className="text-xs text-slate-400">Зарплата</div>
            {vacancy.salary > 0 ? (
              <div className="text-2xl font-bold text-emerald-300">
                {vacancy.salary.toLocaleString("ru-RU")}
                <span className="ml-1 text-sm font-normal text-slate-400">{vacancy.salaryCurrency || "₽"}</span>
              </div>
            ) : (
              <div className="text-base text-slate-400">По договору</div>
            )}
          </div>
        </div>
        {vacancy.skills && vacancy.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {vacancy.skills.map((s) => (
              <span key={s} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-200">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Описание вакансии
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{vacancy.description}</p>
          </div>

          {isOwner && <SuggestedCandidates vacancyId={vacancy.id} />}

          {isOwner && applications && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Applications <span className="text-slate-500">({applications.length})</span>
              </h2>
              {applications.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                  No applications yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {applications.map((a) => (
                    <div key={a.id}>
                      <ul className="space-y-3">
                        <ApplicationRow app={a} onChanged={refresh} />
                      </ul>
                      <TrialTaskBlock applicationId={a.id} isRecruiter isCandidate={false} onChanged={refresh} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {!isOwner && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <div className="mb-3 flex items-center gap-1.5">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Откликнуться
                </h2>
                <HelpTip>
                  <p className="mb-1 font-semibold text-white">Как подать отклик?</p>
                  <p><strong>⚡ Quick Apply</strong> — один клик, система автоматически составит сопроводительное письмо из вашего профиля. Доступно если у вас заполнен профиль и в вакансии нет доп. вопросов.</p>
                  <p className="mt-1.5"><strong>Полная форма</strong> — вручную напишите сообщение и ответьте на вопросы работодателя.</p>
                </HelpTip>
              </div>
              {(vacancy.questions || []).length === 0 && !myApplied && (
                <div className="mb-3">
                  <QuickApplyButton vacancyId={vacancy.id} />
                  <p className="mt-1 text-xs text-slate-500">
                    Один клик — профиль отправляется автоматически
                  </p>
                </div>
              )}
              <ApplicationForm
                vacancyId={vacancy.id}
                alreadyApplied={myApplied}
                questions={vacancy.questions || []}
                onApplied={refresh}
              />
            </div>
          )}
          <ShareVacancyBlock vacancyId={vacancy.id} />
        </aside>
      </div>
    </BuildShell>
  );
}

function SuggestedCandidates({ vacancyId }: { vacancyId: string }) {
  const [items, setItems] = useState<(TalentRow & { matchScore: number; matchedSkills: string[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildApi
      .matchCandidates(vacancyId)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setNote(r.note ?? null);
        setLoaded(true);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vacancyId]);

  if (loading) return <p className="mt-6 text-sm text-slate-400">Searching talent pool…</p>;
  if (!loaded) return null;

  if (note === "vacancy_has_no_required_skills") {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
        Add required skills to this vacancy and we&apos;ll surface matching candidates here automatically.
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-white">
        Suggested candidates <span className="text-slate-500">({items.length})</span>
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        From the AEVION talent pool, ranked by skill-coverage. They haven&apos;t applied yet — DM them to invite.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((c) => {
          const matchTone =
            c.matchScore >= 80
              ? "bg-emerald-500/20 text-emerald-200"
              : c.matchScore >= 50
                ? "bg-amber-500/20 text-amber-200"
                : "bg-slate-500/15 text-slate-300";
          const initials = c.name
            .split(/\s+/)
            .map((s) => s.charAt(0))
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return (
            <div key={c.userId} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start gap-3">
                {c.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
                    {initials || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/build/u/${encodeURIComponent(c.userId)}`}
                      className="truncate text-sm font-semibold text-white hover:text-emerald-200"
                    >
                      {c.name}
                    </Link>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${matchTone}`}>
                      {c.matchScore}% match
                    </span>
                    {c.openToWork && (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                        open
                      </span>
                    )}
                  </div>
                  {c.title && <div className="truncate text-xs text-emerald-200/80">{c.title}</div>}
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    {c.city && <span>📍 {c.city}</span>}
                    {c.experienceYears > 0 && <span>⏱ {c.experienceYears}y</span>}
                  </div>
                  {c.matchedSkills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.matchedSkills.slice(0, 6).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200"
                        >
                          ✓ {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={`/build/messages?to=${encodeURIComponent(c.userId)}`}
                  className="rounded-md bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
                >
                  Invite via DM
                </Link>
                <Link
                  href={`/build/u/${encodeURIComponent(c.userId)}`}
                  className="rounded-md bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                >
                  Profile →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<ApplicationStatus, string> = {
  PENDING: "bg-slate-500/15 text-slate-200 border-slate-500/30",
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

function ApplicationRow({ app, onChanged }: { app: BuildApplication; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const matchScore = app.matchScore;
  const matchTone =
    matchScore == null
      ? "bg-slate-500/15 text-slate-300"
      : matchScore >= 80
        ? "bg-emerald-500/20 text-emerald-200"
        : matchScore >= 50
          ? "bg-amber-500/20 text-amber-200"
          : "bg-slate-500/15 text-slate-300";
  const aiScore = app.aiScoreOverall;
  const aiTone =
    aiScore == null
      ? ""
      : aiScore >= 80
        ? "bg-fuchsia-500/20 text-fuchsia-100"
        : aiScore >= 50
          ? "bg-amber-500/20 text-amber-200"
          : "bg-rose-500/15 text-rose-200";
  let aiDetails: {
    perAnswer?: { question: string; answer: string; score: number; reasoning: string }[];
    redFlags?: string[];
    summary?: string;
  } | null = null;
  if (app.aiScoresJson) {
    try {
      aiDetails = JSON.parse(app.aiScoresJson);
    } catch {
      aiDetails = null;
    }
  }
  return (
    <li className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/build/u/${encodeURIComponent(app.userId)}`}
              className="text-sm font-semibold text-white hover:text-emerald-200"
            >
              {app.applicantName || app.email || app.userId}
            </Link>
            {matchScore != null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${matchTone}`}
                title={`${app.matchedSkills?.length || 0} of required skills matched`}
              >
                {matchScore}% match
              </span>
            )}
            {aiScore != null && (
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${aiTone}`}
                title="Click to see AI breakdown"
              >
                ✨ AI {aiScore}/100
              </button>
            )}
          </div>
          {app.applicantHeadline && (
            <div className="mt-0.5 text-xs text-emerald-200/80">{app.applicantHeadline}</div>
          )}
          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
            {app.applicantCity && <span>📍 {app.applicantCity}</span>}
            {app.applicantExperienceYears != null && app.applicantExperienceYears > 0 && (
              <span>⏱ {app.applicantExperienceYears} лет опыта</span>
            )}
            <span className="text-slate-500">{new Date(app.createdAt).toLocaleDateString("ru-RU")}</span>
          </div>
          {(app.matchedSkills?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {app.matchedSkills!.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[app.status]}`}
        >
          {{ PENDING: "⏳ Ожидает", ACCEPTED: "✅ Принят", REJECTED: "✕ Отклонён" }[app.status] ?? app.status}
        </span>
      </div>
      {app.message && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{app.message}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/build/messages?to=${encodeURIComponent(app.userId)}`}
          className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/20"
        >
          💬 Написать
        </Link>
        <Link
          href={`/build/u/${encodeURIComponent(app.userId)}`}
          className="rounded-md bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10"
        >
          Профиль →
        </Link>
        {app.status !== "ACCEPTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await buildApi.updateApplication(app.id, "ACCEPTED");
                onChanged();
                if (r.hireOrder && r.hireOrder.amount > 0 && r.hireOrder.status === "PENDING") {
                  // Open Stripe Checkout or dev-mode pay
                  try {
                    const checkout = await buildApi.checkoutOrder(r.hireOrder.id);
                    if (checkout.url) {
                      window.location.href = checkout.url;
                    } else if (checkout.devMode) {
                      alert(`[Dev] Hire fee ${r.hireOrder.amount.toLocaleString()} ${r.hireOrder.currency} помечен как оплаченный (dev mode).`);
                    }
                  } catch {
                    alert(`Hire fee: ${r.hireOrder.amount.toLocaleString()} ${r.hireOrder.currency}. Оплатите в разделе «Мои заказы».`);
                  }
                }
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            ✓ Принять
          </button>
        )}
        {app.status !== "REJECTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "REJECTED");
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            ✕ Отклонить
          </button>
        )}
        {app.status === "ACCEPTED" && (
          <button
            onClick={async () => {
              try {
                const r = await buildApi.generateContract(app.id);
                window.open(r.qsignUrl, "_blank", "noreferrer");
              } catch {/**/}
            }}
            className="rounded-md border border-teal-500/30 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-200 hover:bg-teal-500/20"
          >
            📄 Договор (QSign)
          </button>
        )}
      </div>
      {aiOpen && aiDetails && (
        <div className="mt-3 space-y-2 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs">
          {aiDetails.summary && (
            <p className="text-fuchsia-100/90">
              <span className="font-semibold text-fuchsia-200">AI summary:</span> {aiDetails.summary}
            </p>
          )}
          {(aiDetails.perAnswer || []).map((pa, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fuchsia-200">Q{i + 1}.</span>
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] text-fuchsia-100">
                  {pa.score}/100
                </span>
              </div>
              <div className="mt-1 text-slate-300">{pa.question}</div>
              <div className="mt-1 whitespace-pre-wrap text-slate-200">↳ {pa.answer || "(empty)"}</div>
              {pa.reasoning && (
                <div className="mt-1 italic text-slate-400">{pa.reasoning}</div>
              )}
            </div>
          ))}
          {(aiDetails.redFlags || []).length > 0 && (
            <div>
              <div className="font-semibold text-rose-200">⚠ Red flags</div>
              <ul className="mt-1 list-disc pl-4 text-rose-200/90">
                {aiDetails.redFlags!.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ShareVacancyBlock({ vacancyId }: { vacancyId: string }) {
  const me = useBuildAuth((s) => s.user);
  const [copied, setCopied] = useState(false);

  function buildLink(withRef: boolean) {
    if (typeof window === "undefined") return "";
    const url = new URL(`${window.location.origin}/build/vacancy/${encodeURIComponent(vacancyId)}`);
    if (withRef && me?.id) url.searchParams.set("ref", me.id);
    return url.toString();
  }

  async function copy(withRef: boolean) {
    const text = buildLink(withRef);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: prompt
      window.prompt("Скопируйте ссылку:", text);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Поделиться
      </h2>
      <p className="text-xs text-slate-400">
        Скопируйте ссылку для друга. Если они откликнутся через ваш реферал — это засчитывается в платформенный лидерборд (скоро).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => copy(false)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          🔗 Copy link
        </button>
        {me && (
          <button
            onClick={() => copy(true)}
            className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
          >
            🎯 Copy ref-link
          </button>
        )}
        {copied && <span className="text-xs text-emerald-300">Скопировано ✓</span>}
      </div>
    </div>
  );
}
