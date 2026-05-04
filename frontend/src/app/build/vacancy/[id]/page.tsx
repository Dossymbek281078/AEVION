"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { BuildShell } from "@/components/build/BuildShell";
import { ApplicationForm } from "@/components/build/ApplicationForm";
import { TrialTaskBlock } from "@/components/build/TrialTaskBlock";
import {
  buildApi,
  type BuildVacancy,
  type BuildApplication,
  type ApplicationStatus,
  type TalentRow,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { emailError, isEmail } from "@/lib/build/validate";
import { useToast } from "@/components/build/Toast";
import { VacancyDetailSkeleton } from "@/components/build/Skeleton";

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
        <VacancyDetailSkeleton />
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
      <Link
        href={`/build/project/${encodeURIComponent(vacancy.projectId)}`}
        className="text-xs text-slate-400 underline-offset-2 hover:underline"
      >
        ← {vacancy.projectTitle || "Back to project"}
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{vacancy.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Posted {new Date(vacancy.createdAt).toLocaleDateString()}</span>
            <span className={vacancy.status === "OPEN" ? "text-emerald-300" : "text-slate-500"}>
              {vacancy.status}
            </span>
            <VacancyExpiryBadge expiresAt={vacancy.expiresAt} status={vacancy.status} />
            {isOwner && vacancy.viewCount != null && vacancy.viewCount > 0 && (
              <span title="Total page views">👁 {vacancy.viewCount} views</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-400">Salary</div>
            <div className="text-2xl font-semibold text-emerald-300">
              {vacancy.salary > 0 ? `$${vacancy.salary.toLocaleString()}` : "—"}
            </div>
          </div>
          {isOwner && (
            <VacancyStatusToggle
              vacancyId={vacancy.id}
              currentStatus={vacancy.status}
              onToggled={refresh}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Role description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{vacancy.description}</p>
            {vacancy.skills && vacancy.skills.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Required skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {vacancy.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs text-emerald-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isOwner && <SuggestedCandidates vacancyId={vacancy.id} />}

          {isOwner && applications && (
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">
                  Applications <span className="text-slate-500">({applications.length})</span>
                </h2>
                {applications.length > 0 && (
                  <a
                    href={`/api/build/applications/by-vacancy/${encodeURIComponent(vacancy.id)}/export.csv`}
                    className="rounded-md border border-white/10 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10"
                    download
                  >
                    ↓ CSV
                  </a>
                )}
              </div>
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
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Apply
              </h2>
              <ApplicationForm
                vacancyId={vacancy.id}
                alreadyApplied={myApplied}
                questions={vacancy.questions || []}
                onApplied={refresh}
              />
            </div>
          )}
          {isOwner && (applications !== null || vacancy.viewCount != null) && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Analytics</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold text-white">{vacancy.viewCount ?? "—"}</div>
                  <div className="text-[10px] text-slate-500">Views</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{applications?.length ?? "—"}</div>
                  <div className="text-[10px] text-slate-500">Applied</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {vacancy.viewCount && applications?.length
                      ? `${Math.round((applications.length / vacancy.viewCount) * 100)}%`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-500">Conv.</div>
                </div>
              </div>
            </div>
          )}

          <ShareVacancyBlock vacancyId={vacancy.id} />

          {isOwner && <InviteCandidateBlock vacancyId={vacancy.id} />}

          {!isOwner && vacancy.skills && vacancy.skills.length > 0 && (
            <SalaryMarketWidget skill={vacancy.skills[0]} />
          )}

          {vacancy.clientId && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Employer</div>
              <Link
                href={`/build/u/${encodeURIComponent(vacancy.clientId)}`}
                className="text-emerald-300 hover:underline"
              >
                View employer profile →
              </Link>
            </div>
          )}
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
  const toast = useToast();
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
              <span>⏱ {app.applicantExperienceYears}y</span>
            )}
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
          className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[app.status]}`}
        >
          {app.status}
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
          Message
        </Link>
        {app.status !== "ACCEPTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await buildApi.updateApplication(app.id, "ACCEPTED");
                onChanged();
                if (r.hireOrder && r.hireOrder.amount > 0) {
                  toast.success(
                    `Кандидат принят. Hire fee: ${r.hireOrder.amount.toLocaleString()} ${r.hireOrder.currency} — оплатите в «Settings → Orders».`,
                  );
                } else {
                  toast.success("Candidate accepted.");
                }
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Accept
          </button>
        )}
        {app.status !== "REJECTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              const reason = prompt("Reason for rejection (optional, shown to candidate):");
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "REJECTED", reason?.trim() || undefined);
                onChanged();
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            Reject
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

function SalaryMarketWidget({ skill }: { skill: string }) {
  const [data, setData] = useState<{ median: number; count: number } | null>(null);

  useEffect(() => {
    buildApi.salaryStats(skill).then(setData).catch(() => {});
  }, [skill]);

  if (!data || data.count < 3) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Market salary for «{skill}»
      </div>
      <div className="text-xl font-bold text-emerald-300">
        ${data.median.toLocaleString()} <span className="text-xs font-normal text-slate-400">median</span>
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">Based on {data.count} vacancies on QBuild</div>
    </div>
  );
}

function InviteCandidateBlock({ vacancyId }: { vacancyId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const validationError = emailError(email);
  const canSubmit = !busy && isEmail(email);

  async function invite() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    try {
      await buildApi.inviteCandidate(vacancyId, email.trim());
      setMsg({ ok: true, text: `Invite sent to ${email.trim()}` });
      setEmail("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Invite candidate</div>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) invite();
          }}
          placeholder="candidate@email.com"
          aria-invalid={validationError ? true : undefined}
          className={`flex-1 rounded-md border bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none ${
            validationError
              ? "border-rose-500/40 focus:border-rose-500/60"
              : "border-white/10 focus:border-emerald-500/40"
          }`}
        />
        <button
          onClick={invite}
          disabled={!canSubmit}
          className="rounded-md bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/30 disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </div>
      {validationError && (
        <p className="mt-1.5 text-xs text-rose-300">{validationError}</p>
      )}
      {msg && (
        <p className={`mt-1.5 text-xs ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>{msg.text}</p>
      )}
    </div>
  );
}

function VacancyExpiryBadge({
  expiresAt,
  status,
}: {
  expiresAt?: string | null;
  status: string;
}) {
  if (!expiresAt || status !== "OPEN") return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days > 14) return null;
  if (days < 0) {
    return (
      <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
        expired
      </span>
    );
  }
  const tone =
    days <= 1
      ? "bg-rose-500/20 text-rose-200"
      : days <= 3
        ? "bg-amber-500/25 text-amber-100"
        : "bg-amber-500/15 text-amber-200";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
      title={`Closes ${new Date(expiresAt).toLocaleDateString()}`}
    >
      {days === 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`}
    </span>
  );
}

function VacancyStatusToggle({
  vacancyId,
  currentStatus,
  onToggled,
}: {
  vacancyId: string;
  currentStatus: string;
  onToggled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isOpen = currentStatus === "OPEN";
  async function toggle() {
    setBusy(true);
    try {
      await buildApi.patchVacancy(vacancyId, { status: isOpen ? "CLOSED" : "OPEN" });
      onToggled();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        isOpen
          ? "border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
          : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
      }`}
    >
      {busy ? "…" : isOpen ? "Close vacancy" : "Reopen vacancy"}
    </button>
  );
}
