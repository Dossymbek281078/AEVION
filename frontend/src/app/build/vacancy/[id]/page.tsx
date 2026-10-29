"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BuildShell } from "@/components/build/BuildShell";
import { ApplicationForm } from "@/components/build/ApplicationForm";
import { TrialTaskBlock } from "@/components/build/TrialTaskBlock";
import {
  buildApi,
  type BuildVacancy,
  type BuildApplication,
  type ApplicationStatus,
  type ApplicationLabel,
  type TalentRow,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { useI18n } from "@/lib/i18n";
import { formatSalary } from "@/lib/build/format";
import { emailError, isEmail } from "@/lib/build/validate";
import { useToast } from "@/components/build/Toast";
import { VacancyDetailSkeleton } from "@/components/build/Skeleton";
import { recordVacancyView } from "@/lib/build/recentlyViewed";
import { renderMarkdown } from "@/lib/build/markdown";
import { regionLabelIn, workModeLabelIn, educationLabelIn } from "@/lib/build/geo";
import { useBuildT, type BuildKey } from "../../i18n";

export default function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useBuildAuth((s) => s.user);
  const searchParams = useSearchParams();
  const previewMode = searchParams.get("preview");
  const { t: tb, st, lang, date } = useBuildT();

  const [vacancy, setVacancy] = useState<BuildVacancy | null>(null);
  const [applications, setApplications] = useState<BuildApplication[] | null>(null);
  const [myApplied, setMyApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<ApplicationLabel | "ALL">("ALL");
  const [minAi, setMinAi] = useState<number>(0);
  const [minMatch, setMinMatch] = useState<number>(0);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedAppIdx, setFocusedAppIdx] = useState<number>(-1);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    buildApi
      .getVacancy(id)
      .then(async (v) => {
        setVacancy(v);
        recordVacancyView({ id: v.id, title: v.title, salary: v.salary, city: v.city });
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

  // Recruiter keyboard shortcuts on the application list. Only active when
  // applications are loaded for the owner — i.e. when the panel is visible.
  // We intentionally bail if focus is in a text input so typing into the
  // composer doesn't trigger accept/reject.
  useEffect(() => {
    if (!applications || applications.length === 0) return;
    const filtered = applications.filter((a) =>
      labelFilter === "ALL" ? true : a.labelKey === labelFilter,
    );
    if (filtered.length === 0) return;

    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      return false;
    }

    async function setLabel(appId: string, label: ApplicationLabel) {
      setApplications((prev) =>
        prev ? prev.map((x) => (x.id === appId ? { ...x, labelKey: label } : x)) : prev,
      );
      try {
        await buildApi.setApplicationLabel(appId, label);
      } catch {
        // Reload on error rather than tracking previous label here.
        refresh();
      }
    }

    async function setStatus(appId: string, status: "ACCEPTED" | "REJECTED") {
      setApplications((prev) =>
        prev ? prev.map((x) => (x.id === appId ? { ...x, status } : x)) : prev,
      );
      try {
        await buildApi.updateApplication(appId, status);
        refresh();
      } catch {
        refresh();
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (!applications) return;
      const list = applications.filter((a) =>
        labelFilter === "ALL" ? true : a.labelKey === labelFilter,
      );
      if (list.length === 0) return;
      const cur = focusedAppIdx >= 0 && focusedAppIdx < list.length ? focusedAppIdx : -1;
      const focusedApp = cur >= 0 ? list[cur] : null;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setFocusedAppIdx((i) => Math.min((i < 0 ? -1 : i) + 1, list.length - 1));
          break;
        case "k":
          e.preventDefault();
          setFocusedAppIdx((i) => Math.max(i - 1, 0));
          break;
        case "?":
          e.preventDefault();
          setShortcutsHelpOpen((v) => !v);
          break;
        case "Escape":
          if (shortcutsHelpOpen) {
            e.preventDefault();
            setShortcutsHelpOpen(false);
          }
          break;
        case "a":
          if (focusedApp && focusedApp.status !== "ACCEPTED") {
            e.preventDefault();
            void setStatus(focusedApp.id, "ACCEPTED");
          }
          break;
        case "r":
          if (focusedApp && focusedApp.status !== "REJECTED") {
            e.preventDefault();
            void setStatus(focusedApp.id, "REJECTED");
          }
          break;
        case "t":
          if (focusedApp) {
            e.preventDefault();
            void setLabel(focusedApp.id, "TOP_PICK");
          }
          break;
        case "s":
          if (focusedApp) {
            e.preventDefault();
            void setLabel(focusedApp.id, "SHORTLIST");
          }
          break;
        case "i":
          if (focusedApp) {
            e.preventDefault();
            void setLabel(focusedApp.id, "INTERVIEW");
          }
          break;
        case "h":
          if (focusedApp) {
            e.preventDefault();
            void setLabel(focusedApp.id, "HOLD");
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applications, labelFilter, focusedAppIdx, shortcutsHelpOpen, refresh]);

  // Auto-scroll the focused application into view.
  useEffect(() => {
    if (focusedAppIdx < 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-app-idx="${focusedAppIdx}"]`,
    );
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedAppIdx]);

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
        <p className="py-8 text-sm text-rose-300">{error || tb("vac.notFound")}</p>
        <Link href="/build" className="text-sm text-emerald-300 underline">
          {tb("common.backToProjects")}
        </Link>
      </BuildShell>
    );
  }

  const isActualOwner = me?.id === vacancy.clientId;
  // ?preview=candidate hides every owner-only UI element so the recruiter
  // can self-check exactly what an applicant sees. We track ownership in
  // two variables: isActualOwner (real ACL) for the banner; isOwner (effective
  // for rendering) flips to false in preview mode.
  const previewing = isActualOwner && previewMode === "candidate";
  const isOwner = isActualOwner && !previewing;
  const embedded = searchParams.get("embed") === "1";

  // ?embed=1 strips BuildShell entirely so the page can render inside an
  // <iframe> on a partner site without leaking platform navigation. Owner-only
  // tooling is also implicitly hidden because nothing is "owned" from a
  // public iframe perspective.
  const Shell = embedded
    ? ({ children }: { children: React.ReactNode }) => (
        <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
          <div className="mx-auto max-w-3xl">{children}</div>
          <footer className="mx-auto mt-8 max-w-3xl border-t border-white/5 pt-3 text-center text-[10px] text-slate-500">
            {tb("vac.poweredBy")}{" "}
            <a
              href="https://aevion.app/build"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 hover:underline"
            >
              AEVION QBuild
            </a>
          </footer>
        </main>
      )
    : BuildShell;

  return (
    <Shell>
      {previewing && !embedded && <PreviewAsCandidateBanner vacancyId={vacancy.id} />}
      <Link
        href={`/build/project/${encodeURIComponent(vacancy.projectId)}`}
        className="text-xs text-slate-400 underline-offset-2 hover:underline"
      >
        ← {vacancy.projectTitle || tb("vac.backToProject")}
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{vacancy.title}</h1>
          {(vacancy.city || vacancy.region || vacancy.workMode || vacancy.minExperienceYears != null || vacancy.educationLevel) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              {vacancy.city && <span>📍 {vacancy.city}{vacancy.region ? `, ${regionLabelIn(vacancy.region, lang)}` : ""}</span>}
              {!vacancy.city && vacancy.region && <span>📍 {regionLabelIn(vacancy.region, lang)}</span>}
              {vacancy.workMode && <span>{workModeLabelIn(vacancy.workMode, lang)}</span>}
              {vacancy.minExperienceYears != null && <span>{tb("vac.fromExp", { n: vacancy.minExperienceYears })}</span>}
              {vacancy.educationLevel && <span>🎓 {educationLabelIn(vacancy.educationLevel, lang)}</span>}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{tb("vac.posted", { date: date(vacancy.createdAt) })}</span>
            <span className={vacancy.status === "OPEN" ? "text-emerald-300" : "text-slate-500"}>
              {st("vstatus", vacancy.status)}
            </span>
            <VacancyExpiryBadge expiresAt={vacancy.expiresAt} status={vacancy.status} />
            {vacancy.viewCount != null && vacancy.viewCount >= 5 && (
              <span title={tb("vac.viewsTitle")}>{tb("vac.viewsN", { n: vacancy.viewCount })}</span>
            )}
            <ApplyRateChip
              views={vacancy.viewCount ?? 0}
              apps={applications?.length ?? vacancy.applicationsCount ?? 0}
            />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-slate-400">{tb("vac.salary")}</div>
            <div className="text-2xl font-semibold text-emerald-300">
              {formatSalary(vacancy.salary, vacancy.salaryCurrency, lang)}
            </div>
          </div>
          {isOwner && (
            <div className="flex flex-col items-end gap-1.5">
              <VacancyStatusToggle
                vacancyId={vacancy.id}
                currentStatus={vacancy.status}
                onToggled={refresh}
              />
              <div className="flex flex-wrap justify-end gap-1.5">
                <Link
                  href={`/build/vacancy/${encodeURIComponent(vacancy.id)}?preview=candidate`}
                  className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                  title={tb("vac.previewTitle")}
                >
                  {tb("vac.preview")}
                </Link>
                <CloneVacancyButton
                  vacancyId={vacancy.id}
                  projectId={vacancy.projectId}
                />
                {vacancy.status === "OPEN" && (
                  <UrgentToggleButton vacancy={vacancy} onDone={refresh} />
                )}
                <SaveAsTemplateButton vacancy={vacancy} />
                {(vacancy.status === "CLOSED" || vacancy.status === "ARCHIVED") && (
                  <RepublishVacancyButton
                    vacancyId={vacancy.id}
                    onDone={refresh}
                  />
                )}
                {vacancy.status === "OPEN" && (
                  <ExtendVacancyButton
                    vacancyId={vacancy.id}
                    onDone={refresh}
                  />
                )}
                {vacancy.status !== "ARCHIVED" && (
                  <ArchiveVacancyButton
                    vacancyId={vacancy.id}
                    onDone={refresh}
                  />
                )}
                {(applications?.length ?? 0) === 0 && (
                  <DeleteVacancyButton
                    vacancyId={vacancy.id}
                    projectId={vacancy.projectId}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {tb("vac.roleDesc")}
              </h2>
              {isOwner && (
                <div className="flex items-center gap-1.5">
                  <VacancyFeedbackButton vacancyId={vacancy.id} />
                  <TranslateVacancyButton
                    title={vacancy.title}
                    description={vacancy.description}
                  />
                </div>
              )}
            </div>
            <div
              className="space-y-2 text-sm text-slate-200 [&_a]:text-emerald-300 [&_a]:hover:underline [&_strong]:text-white [&_em]:italic"
              // renderMarkdown escapes input first, then emits a known-safe subset.
              dangerouslySetInnerHTML={{ __html: renderMarkdown(vacancy.description) }}
            />
            {vacancy.skills && vacancy.skills.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {tb("vac.reqSkills")}
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
                  {tb("vac.applications")} <span className="text-slate-500">({applications.length})</span>
                </h2>
                {applications.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShortcutsHelpOpen(true)}
                      className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-mono text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
                      title={tb("vac.kbdTitle")}
                      aria-label={tb("vac.kbdTitle")}
                    >
                      ⌨ ?
                    </button>
                    <AiShortlistButton
                      vacancyId={vacancy.id}
                      pendingCount={applications.filter((a) => a.status === "PENDING").length}
                      onLabel={(appId, label) =>
                        setApplications((prev) =>
                          prev ? prev.map((x) => (x.id === appId ? { ...x, labelKey: label } : x)) : prev,
                        )
                      }
                    />
                    <BulkMessageButton vacancyId={vacancy.id} pendingCount={applications.filter((a) => a.status === "PENDING").length} />
                    <ExportCsvButton vacancyId={vacancy.id} vacancyTitle={vacancy.title} />
                  </div>
                )}
              </div>
              {applications.length === 0 ? (
                <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                  {tb("vac.noApps")}
                </p>
              ) : (
                <>
                  <ApplicationLabelFilter
                    applications={applications}
                    value={labelFilter}
                    onChange={(v) => {
                      setLabelFilter(v);
                      setSelected(new Set());
                    }}
                  />
                  <ScoreRangeFilter
                    minAi={minAi}
                    minMatch={minMatch}
                    onChange={(ai, match) => {
                      setMinAi(ai);
                      setMinMatch(match);
                      setSelected(new Set());
                    }}
                  />
                  {(() => {
                    const nowMs = Date.now();
                    const snoozedCount = applications.filter(
                      (a) => a.status === "PENDING" && a.snoozedUntil && new Date(a.snoozedUntil).getTime() > nowMs,
                    ).length;
                    if (snoozedCount === 0) return null;
                    return (
                      <div className="mb-3 flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
                        <span className="text-slate-300">
                          {tb("vac.snoozedN", { n: snoozedCount })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnoozed((v) => !v);
                            setSelected(new Set());
                          }}
                          className={`ml-auto rounded-md px-2 py-0.5 ${
                            showSnoozed
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-white/5 text-slate-400 hover:bg-white/10"
                          }`}
                        >
                          {showSnoozed ? tb("vac.hideSnoozed") : tb("vac.showSnoozed")}
                        </button>
                      </div>
                    );
                  })()}
                  {(() => {
                    const nowMs = Date.now();
                    const filtered = applications.filter((a) => {
                      if (labelFilter !== "ALL" && a.labelKey !== labelFilter) return false;
                      if (minAi > 0) {
                        if (a.aiScoreOverall == null || a.aiScoreOverall < minAi) return false;
                      }
                      if (minMatch > 0) {
                        if (a.matchScore == null || a.matchScore < minMatch) return false;
                      }
                      // Snooze: hide PENDING applications whose snoozedUntil is in the future,
                      // unless the user explicitly toggles "Show snoozed".
                      if (
                        !showSnoozed &&
                        a.status === "PENDING" &&
                        a.snoozedUntil &&
                        new Date(a.snoozedUntil).getTime() > nowMs
                      ) {
                        return false;
                      }
                      return true;
                    });
                    return (
                      <>
                        <BulkActionBar
                          selectedIds={Array.from(selected)}
                          onClear={() => setSelected(new Set())}
                          onDone={() => {
                            setSelected(new Set());
                            refresh();
                          }}
                          onOptimistic={(ids, status) =>
                            setApplications((prev) =>
                              prev ? prev.map((x) => (ids.includes(x.id) ? { ...x, status } : x)) : prev,
                            )
                          }
                        />
                        <div className="space-y-3">
                          {filtered.map((a, idx) => (
                            <div
                              key={a.id}
                              data-app-idx={idx}
                              className={`flex gap-2 rounded-xl transition ${
                                focusedAppIdx === idx
                                  ? "bg-emerald-500/[0.04] ring-1 ring-emerald-500/40 -mx-1 px-1"
                                  : ""
                              }`}
                              onClick={() => setFocusedAppIdx(idx)}
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(a.id)}
                                onChange={(e) => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (e.target.checked) next.add(a.id);
                                    else next.delete(a.id);
                                    return next;
                                  });
                                }}
                                aria-label={tb("vac.selectAria", { name: a.applicantName ?? tb("vac.applicationWord") })}
                                className="mt-3 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-emerald-500"
                              />
                              <div className="flex-1 min-w-0">
                                <ul className="space-y-3">
                                  <ApplicationRow
                                    app={a}
                                    onChanged={refresh}
                                    onOptimistic={(status) =>
                                      setApplications((prev) =>
                                        prev ? prev.map((x) => (x.id === a.id ? { ...x, status } : x)) : prev,
                                      )
                                    }
                                    onOptimisticLabel={(labelKey) =>
                                      setApplications((prev) =>
                                        prev ? prev.map((x) => (x.id === a.id ? { ...x, labelKey } : x)) : prev,
                                      )
                                    }
                                  />
                                </ul>
                                <TrialTaskBlock applicationId={a.id} isRecruiter isCandidate={false} onChanged={refresh} />
                              </div>
                            </div>
                          ))}
                          {filtered.length === 0 && (
                            <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-4 text-center text-xs text-slate-500">
                              {tb("vac.noLabelMatch")}
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          {!isOwner && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
                {tb("vac.apply")}
              </h2>
              <ApplicationForm
                vacancyId={vacancy.id}
                alreadyApplied={myApplied}
                questions={vacancy.questions || []}
                onApplied={refresh}
              />
            </div>
          )}
          {isOwner && <VacancySourceMiniPanel vacancyId={vacancy.id} />}

          {isOwner && (applications !== null || vacancy.viewCount != null) && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{tb("common.analytics")}</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold text-white">{vacancy.viewCount ?? "—"}</div>
                  <div className="text-[10px] text-slate-500">{tb("common.views")}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{applications?.length ?? "—"}</div>
                  <div className="text-[10px] text-slate-500">{tb("common.applied")}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">
                    {vacancy.viewCount && applications?.length
                      ? `${Math.round((applications.length / vacancy.viewCount) * 100)}%`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-slate-500">{tb("vac.conv")}</div>
                </div>
              </div>
            </div>
          )}

          <ShareVacancyBlock vacancyId={vacancy.id} />

          {isOwner && <InviteCandidateBlock vacancyId={vacancy.id} />}

          {isOwner && <VacancyTimeline vacancyId={vacancy.id} />}

          {isOwner && <BoostRoiTile vacancyId={vacancy.id} />}

          {isOwner && <VacancyTeamNotes vacancyId={vacancy.id} />}

          {isOwner && <VacancyEditHistory vacancyId={vacancy.id} />}

          {isOwner && <EmbedSnippetBlock vacancyId={vacancy.id} />}

          {!isOwner && vacancy.skills && vacancy.skills.length > 0 && (
            <SalaryMarketWidget skill={vacancy.skills[0]} />
          )}

          {vacancy.clientId && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{tb("vac.employer")}</div>
              <Link
                href={`/build/u/${encodeURIComponent(vacancy.clientId)}`}
                className="text-emerald-300 hover:underline"
              >
                {tb("vac.employerProfile")}
              </Link>
            </div>
          )}
        </aside>
      </div>

      {!isOwner && <SimilarVacancies vacancyId={vacancy.id} />}

      {shortcutsHelpOpen && !embedded && (
        <KeyboardShortcutsHelp onClose={() => setShortcutsHelpOpen(false)} />
      )}
    </Shell>
  );
}

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t, st } = useBuildT();
  const rows: { keys: string[]; text: string }[] = [
    { keys: ["j"], text: t("kbd.next") },
    { keys: ["k"], text: t("kbd.prev") },
    { keys: ["a"], text: t("kbd.accept") },
    { keys: ["r"], text: t("kbd.reject") },
    { keys: ["t"], text: t("kbd.tag", { label: st("label", "TOP_PICK") }) },
    { keys: ["s"], text: t("kbd.tag", { label: st("label", "SHORTLIST") }) },
    { keys: ["i"], text: t("kbd.tag", { label: st("label", "INTERVIEW") }) },
    { keys: ["h"], text: t("kbd.tag", { label: st("label", "HOLD") }) },
    { keys: ["?"], text: t("kbd.toggle") },
    { keys: ["Esc"], text: t("common.close") },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("kbd.title")}
    >
      <div
        className="w-[min(420px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {t("kbd.heading")}
          </h3>
          <button onClick={onClose} aria-label={t("common.close")} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.keys[0]} className="flex items-center justify-between gap-3">
              <div className="flex gap-1">
                {r.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-white/15 bg-white/5 px-1.5 py-1 text-[11px] font-mono text-slate-200"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-slate-300">{r.text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">
          {t("kbd.note")}
        </p>
      </div>
    </div>
  );
}

function SimilarVacancies({ vacancyId }: { vacancyId: string }) {
  const [items, setItems] = useState<
    (BuildVacancy & { overlapCount: number; overlapSkills: string[]; projectCity?: string | null })[]
  >([]);
  const [loaded, setLoaded] = useState(false);
  const { t, lang } = useBuildT();

  useEffect(() => {
    let cancelled = false;
    buildApi
      .similarVacancies(vacancyId)
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vacancyId]);

  if (!loaded || items.length === 0) return null;

  return (
    <section className="mt-10 border-t border-white/5 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t("vac.similar")}</h2>
        <Link href="/build/vacancies" className="text-xs text-emerald-300 hover:underline">
          {t("common.seeAll")}
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <Link
            key={v.id}
            href={`/build/vacancy/${encodeURIComponent(v.id)}`}
            className="group block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-emerald-500/40 hover:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white group-hover:text-emerald-200">
                  {v.title}
                </div>
                {v.projectTitle && (
                  <div className="mt-0.5 truncate text-[11px] text-slate-400">{v.projectTitle}</div>
                )}
              </div>
              <div className="shrink-0 text-right text-sm font-semibold text-emerald-300">
                {formatSalary(v.salary, v.salaryCurrency, lang)}
              </div>
            </div>
            {v.overlapSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {v.overlapSkills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              {v.projectCity && <span>📍 {v.projectCity}</span>}
              {v.overlapCount > 0 && (
                <span className="text-emerald-300/80">{t("vac.skillMatch", { n: v.overlapCount })}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SuggestedCandidates({ vacancyId }: { vacancyId: string }) {
  const [items, setItems] = useState<(TalentRow & { matchScore: number; matchedSkills: string[] })[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { t } = useBuildT();

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

  if (loading) return <p className="mt-6 text-sm text-slate-400">{t("vac.searchingTalent")}</p>;
  if (!loaded) return null;

  if (note === "vacancy_has_no_required_skills") {
    return (
      <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200">
        {t("vac.noSkillsHint")}
      </div>
    );
  }
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-white">
        {t("vac.suggested")} <span className="text-slate-500">({items.length})</span>
      </h2>
      <p className="mb-3 text-xs text-slate-400">
        {t("vac.suggestedNote")}
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
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${matchTone}`}>
                      {t("common.match", { n: c.matchScore })}
                    </span>
                    {c.openToWork && (
                      <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
                        {t("vac.openToWork")}
                      </span>
                    )}
                  </div>
                  {c.title && <div className="truncate text-xs text-emerald-200/80">{c.title}</div>}
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
                    {c.city && <span>📍 {c.city}</span>}
                    {c.experienceYears > 0 && <span>⏱ {t("common.years", { n: c.experienceYears })}</span>}
                  </div>
                  {c.matchedSkills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.matchedSkills.slice(0, 6).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200"
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
                  {t("vac.inviteDm")}
                </Link>
                <Link
                  href={`/build/u/${encodeURIComponent(c.userId)}`}
                  className="rounded-md bg-white/5 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
                >
                  {t("vac.profile")}
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

function ApplicationRow({
  app,
  onChanged,
  onOptimistic,
  onOptimisticLabel,
}: {
  app: BuildApplication;
  onChanged: () => void;
  onOptimistic?: (status: ApplicationStatus) => void;
  onOptimisticLabel?: (labelKey: ApplicationLabel | null) => void;
}) {
  const { t } = useI18n();
  const { t: tb, st, num } = useBuildT();
  const [busy, setBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const toast = useToast();
  const previousStatusRef = useRef<ApplicationStatus>(app.status);
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
                className={`rounded-full px-2 py-1 text-xs font-bold ${matchTone}`}
                title={tb("vac.matchedTitle", { n: app.matchedSkills?.length || 0 })}
              >
                {tb("common.match", { n: matchScore })}
              </span>
            )}
            {aiScore != null && (
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className={`rounded-full px-2 py-1 text-xs font-bold ${aiTone}`}
                title={tb("vac.aiTitle")}
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
              <span>⏱ {tb("common.years", { n: app.applicantExperienceYears })}</span>
            )}
            {app.sourceTag && (
              <span
                className="rounded bg-slate-500/20 px-1.5 py-1 text-xs text-slate-300"
                title={tb("vac.sourceTitle", { s: app.sourceTag })}
              >
                ↩ {app.sourceTag.replace(/^utm:/, "@").replace(/^ref:/, "←")}
              </span>
            )}
          </div>
          {(app.matchedSkills?.length ?? 0) > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {app.matchedSkills!.slice(0, 6).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200"
                >
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[app.status]}`}
          >
            {st("astatus", app.status)}
          </span>
          <ApplicationLabelPicker
            applicationId={app.id}
            current={app.labelKey ?? null}
            onSet={(lk) => onOptimisticLabel?.(lk)}
          />
        </div>
      </div>
      {app.message && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{app.message}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/build/vacancy/${encodeURIComponent(app.vacancyId)}/review/${encodeURIComponent(app.id)}`}
          className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20"
          title={tb("vac.reviewTitle")}
        >
          {tb("vac.review")}
        </Link>
        <Link
          href={`/build/messages?to=${encodeURIComponent(app.userId)}`}
          className="rounded-md bg-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/20"
        >
          {tb("vac.message")}
        </Link>
        {app.status !== "ACCEPTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              previousStatusRef.current = app.status;
              onOptimistic?.("ACCEPTED");
              setBusy(true);
              try {
                const r = await buildApi.updateApplication(app.id, "ACCEPTED");
                if (r.hireOrder && r.hireOrder.amount > 0) {
                  toast.success(
                    t("build.vacancyDetail.candidateAcceptedHireFee", {
                      amount: num(r.hireOrder.amount),
                      currency: r.hireOrder.currency,
                    }),
                  );
                } else {
                  toast.success(tb("vac.accepted"));
                }
                onChanged();
              } catch (err) {
                onOptimistic?.(previousStatusRef.current);
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {tb("common.accept")}
          </button>
        )}
        {app.status !== "REJECTED" && (
          <RejectButton
            disabled={busy}
            onConfirm={async (composed) => {
              previousStatusRef.current = app.status;
              onOptimistic?.("REJECTED");
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "REJECTED", composed || undefined);
                toast.info(tb("vac.rejected"));
                onChanged();
              } catch (err) {
                onOptimistic?.(previousStatusRef.current);
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
        <InterviewPrepButton applicationId={app.id} />
        <WhyMatchButton applicationId={app.id} />
        {app.status === "PENDING" && (
          <SnoozeApplicationButton
            applicationId={app.id}
            currentSnoozedUntil={app.snoozedUntil ?? null}
            onChanged={onChanged}
          />
        )}
        <FlagApplicationButton applicationId={app.id} />
      </div>
      {aiOpen && aiDetails && (
        <div className="mt-3 space-y-2 rounded-md border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs">
          {aiDetails.summary && (
            <p className="text-fuchsia-100/90">
              <span className="font-semibold text-fuchsia-200">{tb("vac.aiSummary")}</span> {aiDetails.summary}
            </p>
          )}
          {(aiDetails.perAnswer || []).map((pa, i) => (
            <div key={i} className="rounded border border-white/10 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fuchsia-200">Q{i + 1}.</span>
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-100">
                  {pa.score}/100
                </span>
              </div>
              <div className="mt-1 text-slate-300">{pa.question}</div>
              <div className="mt-1 whitespace-pre-wrap text-slate-200">↳ {pa.answer || tb("vac.empty")}</div>
              {pa.reasoning && (
                <div className="mt-1 italic text-slate-400">{pa.reasoning}</div>
              )}
            </div>
          ))}
          {(aiDetails.redFlags || []).length > 0 && (
            <div>
              <div className="font-semibold text-rose-200">{tb("vac.redFlags")}</div>
              <ul className="mt-1 list-disc pl-4 text-rose-200/90">
                {aiDetails.redFlags!.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <RecruiterNotes applicationId={app.id} />
    </li>
  );
}

function ScoreRangeFilter({
  minAi,
  minMatch,
  onChange,
}: {
  minAi: number;
  minMatch: number;
  onChange: (ai: number, match: number) => void;
}) {
  const active = minAi > 0 || minMatch > 0;
  const { t } = useBuildT();
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-[11px]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {t("vac.minScores")}
      </span>
      <label className="flex items-center gap-1.5 text-slate-300">
        <span title={t("vac.aiScoreTitle")}>{t("vac.aiGe")}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={minAi}
          onChange={(e) => onChange(Number(e.target.value), minMatch)}
          aria-label={t("vac.aiScoreTitle")}
          className="h-1 w-24 accent-fuchsia-500"
        />
        <span className="w-7 text-right tabular-nums text-fuchsia-200">{minAi}</span>
      </label>
      <label className="flex items-center gap-1.5 text-slate-300">
        <span title={t("vac.matchTitle")}>{t("vac.matchGe")}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={minMatch}
          onChange={(e) => onChange(minAi, Number(e.target.value))}
          aria-label={t("vac.matchTitle")}
          className="h-1 w-24 accent-emerald-500"
        />
        <span className="w-7 text-right tabular-nums text-emerald-200">{minMatch}</span>
      </label>
      {active && (
        <button
          type="button"
          onClick={() => onChange(0, 0)}
          className="ml-auto text-[10px] text-slate-400 hover:text-slate-200"
        >
          {t("common.clear")}
        </button>
      )}
    </div>
  );
}

function ApplicationLabelFilter({
  applications,
  value,
  onChange,
}: {
  applications: BuildApplication[];
  value: ApplicationLabel | "ALL";
  onChange: (v: ApplicationLabel | "ALL") => void;
}) {
  const counts = applications.reduce<Record<string, number>>((acc, a) => {
    if (a.labelKey) acc[a.labelKey] = (acc[a.labelKey] ?? 0) + 1;
    return acc;
  }, {});
  const labelled = Object.keys(counts);
  const { t, st } = useBuildT();
  if (labelled.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{t("vac.filterByLabel")}</span>
      <button
        onClick={() => onChange("ALL")}
        className={`rounded-md px-2 py-1 text-[11px] font-medium ${
          value === "ALL" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
        }`}
      >
        {t("vac.allN", { n: applications.length })}
      </button>
      {(["TOP_PICK", "SHORTLIST", "INTERVIEW", "OFFER", "HOLD"] as ApplicationLabel[]).map((l) => {
        const n = counts[l] ?? 0;
        if (n === 0) return null;
        const active = value === l;
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
              active ? LABEL_TONE[l] : "border-transparent bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {LABEL_EMOJI[l]} {st("label", l)} ({n})
          </button>
        );
      })}
    </div>
  );
}

function BulkActionBar({
  selectedIds,
  onClear,
  onDone,
  onOptimistic,
}: {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
  onOptimistic: (ids: string[], status: ApplicationStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();
  if (selectedIds.length === 0) return null;

  async function bulk(status: "ACCEPTED" | "REJECTED") {
    if (
      !confirm(
        status === "ACCEPTED"
          ? t("vac.bulkAcceptConfirm", { n: selectedIds.length })
          : t("vac.bulkRejectConfirm", { n: selectedIds.length }),
      )
    ) return;
    let reason: string | undefined;
    if (status === "REJECTED") {
      const r = prompt(t("vac.reasonPrompt")) ?? "";
      reason = r.trim() || undefined;
    }
    setBusy(true);
    onOptimistic(selectedIds, status);
    try {
      const r = await buildApi.bulkUpdateApplicationStatus(selectedIds, status, reason);
      toast.success(r.skipped.length > 0 ? t("vac.bulkSkipped", { n: r.updated, s: r.skipped.length }) : t("vac.bulkDone", { n: r.updated }));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-3 py-2 text-xs">
      <span className="font-semibold text-emerald-200">{t("vac.selectedN", { n: selectedIds.length })}</span>
      <span className="text-slate-500">·</span>
      <button
        onClick={() => bulk("ACCEPTED")}
        disabled={busy}
        className="rounded-md bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {t("vac.bulkAccept")}
      </button>
      <button
        onClick={() => bulk("REJECTED")}
        disabled={busy}
        className="rounded-md bg-rose-500/20 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
      >
        {t("vac.bulkReject")}
      </button>
      <button
        onClick={onClear}
        className="ml-auto text-[11px] text-slate-400 hover:text-slate-200"
      >
        {t("common.clear")}
      </button>
    </div>
  );
}

const LABEL_TONE: Record<ApplicationLabel, string> = {
  TOP_PICK: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100",
  SHORTLIST: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  INTERVIEW: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  OFFER: "border-amber-300/50 bg-amber-300/15 text-amber-100",
  HOLD: "border-slate-500/40 bg-slate-500/10 text-slate-200",
};
const LABEL_EMOJI: Record<ApplicationLabel, string> = {
  TOP_PICK: "★",
  SHORTLIST: "✓",
  INTERVIEW: "📞",
  OFFER: "📝",
  HOLD: "⏸",
};
const LABEL_OPTIONS: ApplicationLabel[] = ["TOP_PICK", "SHORTLIST", "INTERVIEW", "OFFER", "HOLD"];

function ApplicationLabelPicker({
  applicationId,
  current,
  onSet,
}: {
  applicationId: string;
  current: ApplicationLabel | null;
  onSet: (label: ApplicationLabel | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { t, st } = useBuildT();

  async function set(label: ApplicationLabel | null) {
    const prev = current;
    onSet(label);
    setOpen(false);
    try {
      await buildApi.setApplicationLabel(applicationId, label);
    } catch (e) {
      onSet(prev);
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-full border px-2 py-1 text-xs font-semibold ${
          current ? LABEL_TONE[current] : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
        }`}
        title={t("vac.labelTitle")}
      >
        {current ? `${LABEL_EMOJI[current]} ${st("label", current)}` : t("vac.addLabel")}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-white/10 bg-slate-900 p-1 shadow-2xl">
          {LABEL_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => set(l)}
              className={`block w-full rounded px-2 py-1 text-left text-[11px] hover:bg-white/5 ${
                current === l ? "text-emerald-200" : "text-slate-200"
              }`}
            >
              {LABEL_EMOJI[l]} {st("label", l)}
            </button>
          ))}
          {current && (
            <button
              type="button"
              onClick={() => set(null)}
              className="mt-0.5 block w-full rounded border-t border-white/5 px-2 py-1 text-left text-[11px] text-slate-500 hover:bg-white/5 hover:text-rose-300"
            >
              {t("vac.clearLabel")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RecruiterNotes({ applicationId }: { applicationId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<
    { id: string; body: string; createdAt: string; authorUserId: string; isPinned: boolean }[]
  >([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();
  const { t, dateTime } = useBuildT();

  useEffect(() => {
    if (!open || loaded) return;
    buildApi
      .applicationNotes(applicationId)
      .then((r) => setItems(r.items))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [open, loaded, applicationId]);

  async function add() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const r = await buildApi.addApplicationNote(applicationId, body);
      setItems((prev) => [r, ...prev]);
      setDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(noteId: string) {
    try {
      await buildApi.deleteApplicationNote(applicationId, noteId);
      setItems((prev) => prev.filter((n) => n.id !== noteId));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function togglePin(noteId: string, isPinned: boolean) {
    // Optimistic
    setItems((prev) => {
      const updated = prev.map((n) => (n.id === noteId ? { ...n, isPinned } : n));
      // Re-sort: pinned first, then createdAt desc.
      return updated.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });
    try {
      await buildApi.pinApplicationNote(applicationId, noteId, isPinned);
    } catch (e) {
      // Roll back on failure
      setItems((prev) => prev.map((n) => (n.id === noteId ? { ...n, isPinned: !isPinned } : n)));
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[11px] text-slate-400 hover:text-slate-200"
      >
        {open ? "▼" : "▶"} {t("vac.privateNotes")} {loaded && items.length > 0 ? `(${items.length})` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={t("vac.notePh")}
              aria-label={t("vac.notePh")}
              className="flex-1 rounded border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !draft.trim()}
              className="self-start rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {busy ? "…" : t("common.add")}
            </button>
          </div>
          {!loaded ? (
            <p className="text-xs text-slate-500">{t("common.loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-slate-500">{t("vac.noNotes")}</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded border p-2 text-xs ${
                    n.isPinned
                      ? "border-amber-500/40 bg-amber-500/[0.07]"
                      : "border-white/5 bg-black/20"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-slate-200">
                    {n.isPinned && <span className="mr-1 text-amber-300">📌</span>}
                    {n.body}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{dateTime(n.createdAt)}</span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => togglePin(n.id, !n.isPinned)}
                        className={n.isPinned ? "text-amber-300 hover:text-amber-200" : "hover:text-slate-300"}
                        title={n.isPinned ? t("vac.unpin") : t("vac.pinTitle")}
                      >
                        {n.isPinned ? t("vac.unpin") : t("vac.pin")}
                      </button>
                      <button onClick={() => remove(n.id)} className="hover:text-rose-300">
                        {t("common.delete")}
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ShareVacancyBlock({ vacancyId }: { vacancyId: string }) {
  const { t } = useI18n();
  const { t: tb } = useBuildT();
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
      window.prompt(t("build.vacancyDetail.share.copyLinkPrompt"), text);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {t("build.vacancyDetail.share.heading")}
      </h2>
      <p className="text-xs text-slate-400">
        {t("build.vacancyDetail.share.description")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => copy(false)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          {tb("vac.copyLink")}
        </button>
        {me && (
          <button
            onClick={() => copy(true)}
            className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
          >
            {tb("vac.copyRef")}
          </button>
        )}
        <QuickShareButtons getLink={() => buildLink(!!me)} />
        {copied && <span className="text-xs text-emerald-300">{t("build.vacancyDetail.share.copied")}</span>}
      </div>
    </div>
  );
}

function QuickShareButtons({ getLink }: { getLink: () => string }) {
  const { t } = useBuildT();
  function open(url: string) {
    if (typeof window === "undefined") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  function tg() {
    const u = encodeURIComponent(getLink());
    open(`https://t.me/share/url?url=${u}&text=${encodeURIComponent(t("vac.shareText"))}`);
  }
  function wa() {
    const u = encodeURIComponent(`${t("vac.shareText")}: ${getLink()}`);
    open(`https://wa.me/?text=${u}`);
  }
  function li() {
    const u = encodeURIComponent(getLink());
    open(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`);
  }
  function tw() {
    const u = encodeURIComponent(getLink());
    open(`https://twitter.com/intent/tweet?url=${u}&text=${encodeURIComponent(t("vac.hiringText"))}`);
  }
  const base =
    "rounded-md border px-2 py-1.5 text-xs font-semibold transition";
  return (
    <>
      <button
        type="button"
        onClick={tg}
        title={t("vac.shareTg")}
        className={`${base} border-sky-400/40 bg-sky-400/15 text-sky-100 hover:bg-sky-400/25`}
      >
        ✈ Telegram
      </button>
      <button
        type="button"
        onClick={wa}
        title={t("vac.shareWa")}
        className={`${base} border-emerald-400/40 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25`}
      >
        🟢 WhatsApp
      </button>
      <button
        type="button"
        onClick={li}
        title={t("vac.shareLi")}
        className={`${base} border-blue-400/40 bg-blue-400/15 text-blue-100 hover:bg-blue-400/25`}
      >
        in LinkedIn
      </button>
      <button
        type="button"
        onClick={tw}
        title={t("vac.shareX")}
        aria-label={t("vac.shareX")}
        className={`${base} border-white/20 bg-white/10 text-slate-100 hover:bg-white/20`}
      >
        𝕏
      </button>
    </>
  );
}

function SalaryMarketWidget({ skill }: { skill: string }) {
  const [data, setData] = useState<{ median: number; count: number } | null>(null);
  const { t, num } = useBuildT();

  useEffect(() => {
    buildApi.salaryStats(skill).then(setData).catch(() => {});
  }, [skill]);

  if (!data || data.count < 3) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t("vac.market", { skill })}
      </div>
      <div className="text-xl font-bold text-emerald-300">
        ${num(data.median)} <span className="text-xs font-normal text-slate-400">{t("vac.median")}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500">{t("vac.basedOn", { n: data.count })}</div>
    </div>
  );
}

// Reject reason vocab — bucket key + human label. The bucket gets prefixed
// onto the persisted rejectReason as "reason:bucket|free-form note" so the
// existing column doesn't need a schema change. The dashboard chart parses
// the prefix back out for aggregation.
const REJECT_BUCKETS: { key: string; textKey: BuildKey }[] = [
  { key: "overqualified", textKey: "rej.overqualified" },
  { key: "missing-skill", textKey: "rej.missing-skill" },
  { key: "salary-mismatch", textKey: "rej.salary-mismatch" },
  { key: "location", textKey: "rej.location" },
  { key: "timing", textKey: "rej.timing" },
  { key: "other", textKey: "rej.other" },
];

function RejectButton({
  disabled,
  onConfirm,
}: {
  disabled: boolean;
  onConfirm: (composedReason: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useBuildT();

  async function submit() {
    setBusy(true);
    try {
      const composed = bucket
        ? `reason:${bucket}|${note.trim()}`
        : note.trim();
      await onConfirm(composed);
      setOpen(false);
      setBucket("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
      >
        {t("common.reject")}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-rose-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-200">
            {t("rej.title")}
          </div>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            aria-label={t("rej.categoryAria")}
            className="mb-2 w-full rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white focus:border-rose-500/40 focus:outline-none"
          >
            <option value="">{t("rej.pick")}</option>
            {REJECT_BUCKETS.map((b) => (
              <option key={b.key} value={b.key}>{t(b.textKey)}</option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("rej.notePh")}
            aria-label={t("rej.notePh")}
            rows={3}
            maxLength={500}
            className="w-full rounded border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-slate-500 focus:border-rose-500/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-slate-300 hover:bg-white/5"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-md bg-rose-500 px-3 py-1 text-[11px] font-semibold text-rose-50 hover:bg-rose-400 disabled:opacity-50"
            >
              {busy ? "…" : t("rej.confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VacancySourceMiniPanel({ vacancyId }: { vacancyId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.recruiterSourceBreakdown>> | null>(null);
  const { t } = useBuildT();

  useEffect(() => {
    let cancelled = false;
    buildApi
      .recruiterSourceBreakdown({ vacancyId, days: 90 })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vacancyId]);

  if (!data || data.total === 0) return null;

  const order: { key: keyof typeof data.buckets; label: string; color: string }[] = [
    { key: "organic", label: t("src.organic"), color: "#10b981" },
    { key: "utm", label: t("src.utm"), color: "#06b6d4" },
    { key: "ref", label: t("src.ref"), color: "#f59e0b" },
    { key: "widget", label: t("src.widget"), color: "#a855f7" },
    { key: "other", label: t("src.other"), color: "#64748b" },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t("src.title")} <span className="text-slate-600">{t("src.days")}</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
        {order.map(({ key, color }) => {
          const n = data.buckets[key].count;
          if (n === 0) return null;
          const pct = (n / data.total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: color }}
              title={`${order.find((o) => o.key === key)?.label ?? key}: ${n}`}
            />
          );
        })}
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {order.map(({ key, label, color }) => {
          const n = data.buckets[key].count;
          if (n === 0) return null;
          return (
            <li key={key} className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-400">{label}</span>
              <span className="ml-auto tabular-nums text-slate-300">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PreviewAsCandidateBanner({ vacancyId }: { vacancyId: string }) {
  const { t } = useBuildT();
  return (
    <div className="-mx-4 mb-3 border-y border-cyan-400/30 bg-cyan-500/10 px-4 py-2">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 text-xs text-cyan-100">
        <span className="font-semibold">
          {t("vac.previewBanner")}
        </span>
        <Link
          href={`/build/vacancy/${encodeURIComponent(vacancyId)}`}
          className="rounded-md border border-cyan-300/40 bg-cyan-300/15 px-3 py-1 text-cyan-50 hover:bg-cyan-300/25"
        >
          {t("vac.exitPreview")}
        </Link>
      </div>
    </div>
  );
}

function EmbedSnippetBlock({ vacancyId }: { vacancyId: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://aevion.app";
  const snippet = `<div data-aevion-build data-key="qb_pk_..." data-vacancy-id="${vacancyId}"></div>
<script src="${origin}/api/build/public/widget.js" defer></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet).then(
      () => toast.success(t("vac.embedCopied")),
      () => toast.error(t("vac.copyFailed")),
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t("vac.embedH")}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
        >
          {open ? t("common.hide") : t("vac.showSnippet")}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            {t("vac.embedNote1")} <code className="rounded bg-black/40 px-1 text-emerald-200">qb_pk_...</code> {t("vac.embedNote2")}{" "}
            <Link href="/build/admin/partner-keys" className="text-emerald-300 underline">
              {t("vac.partnerKeys")}
            </Link>
            .
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/10 bg-black/40 p-3 text-[11px] text-slate-200">
            <code>{snippet}</code>
          </pre>
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-400/25"
          >
            {t("vac.copySnippet")}
          </button>
        </div>
      )}
    </div>
  );
}

function SnoozeApplicationButton({
  applicationId,
  currentSnoozedUntil,
  onChanged,
}: {
  applicationId: string;
  currentSnoozedUntil: string | null;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const { t, tn } = useBuildT();

  const isSnoozed = !!(currentSnoozedUntil && new Date(currentSnoozedUntil).getTime() > Date.now());
  const daysLeft = isSnoozed
    ? Math.max(0, Math.ceil((new Date(currentSnoozedUntil!).getTime() - Date.now()) / 86400000))
    : 0;

  async function snooze(days: number) {
    setBusy(true);
    try {
      await buildApi.snoozeApplication(applicationId, days);
      if (days > 0) toast.success(t("snz.done", { n: days }));
      else toast.success(t("snz.cleared"));
      onChanged();
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        title={isSnoozed ? t("snz.moreTitle", { n: daysLeft }) : t("snz.title")}
        className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50 ${
          isSnoozed
            ? "border-amber-500/30 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
            : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
        }`}
      >
        💤 {isSnoozed ? t("snz.daysShort", { n: daysLeft }) : t("snz.btn")}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-white/10 bg-slate-900 p-2 shadow-2xl">
          <div className="mb-1 px-1 text-[10px] uppercase tracking-wider text-slate-500">
            {t("snz.for")}
          </div>
          {[1, 3, 7, 14].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => snooze(d)}
              disabled={busy}
              className="block w-full rounded px-2 py-1 text-left text-xs text-slate-200 hover:bg-white/5"
            >
              {tn("snz.days", d)}
            </button>
          ))}
          {isSnoozed && (
            <button
              type="button"
              onClick={() => snooze(0)}
              disabled={busy}
              className="mt-1 block w-full rounded border-t border-white/5 px-2 py-1 text-left text-xs text-rose-200 hover:bg-rose-500/10"
            >
              {t("snz.clear")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FlagApplicationButton({ applicationId }: { applicationId: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const { t } = useBuildT();

  async function flag() {
    const reason = window.prompt(t("flag.prompt"), "spam");
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await buildApi.flagApplication(applicationId, reason.trim().slice(0, 64));
      toast.success(t("flag.done"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={flag}
      disabled={busy}
      title={t("flag.title")}
      aria-label={t("flag.title")}
      className="rounded-md border border-rose-500/20 bg-rose-500/[0.06] px-2.5 py-1.5 text-[11px] font-medium text-rose-200/80 transition hover:bg-rose-500/15 disabled:opacity-50"
    >
      {busy ? "…" : "⚐"}
    </button>
  );
}

function VacancyEditHistory({ vacancyId }: { vacancyId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Awaited<ReturnType<typeof buildApi.vacancyHistory>>["items"] | null>(null);
  const { t, dateTime } = useBuildT();

  useEffect(() => {
    if (!open || items !== null) return;
    let cancelled = false;
    buildApi
      .vacancyHistory(vacancyId)
      .then((r) => {
        if (!cancelled) setItems(r.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, items, vacancyId]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        <span>{t("hist.title")}</span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {items === null ? (
            <p className="text-xs text-slate-500">{t("common.loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-slate-500">{t("hist.none")}</p>
          ) : (
            <ol className="space-y-2 border-l border-white/10 pl-3 text-xs">
              {items.map((e) => (
                <li key={e.id}>
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-slate-200">{e.editorName || t("hist.owner")}</span>
                    <span className="text-slate-500">{dateTime(e.createdAt)}</span>
                  </div>
                  <ul className="mt-0.5 space-y-0.5 text-slate-300">
                    {Object.entries(e.changes).map(([field, ba]) => {
                      const beforeStr = String(ba.before ?? "—").slice(0, 80);
                      const afterStr = String(ba.after ?? "—").slice(0, 80);
                      return (
                        <li key={field}>
                          <span className="font-mono text-slate-400">{field}</span>:{" "}
                          <span className="text-rose-300/80 line-through">{beforeStr}</span>{" "}
                          <span className="text-slate-500">→</span>{" "}
                          <span className="text-emerald-300">{afterStr}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function BoostRoiTile({ vacancyId }: { vacancyId: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.vacancyBoostRoi>> | null>(null);
  const [err, setErr] = useState(false);
  const { t } = useBuildT();

  useEffect(() => {
    let cancelled = false;
    buildApi
      .vacancyBoostRoi(vacancyId)
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [vacancyId]);

  if (err || !data || !data.hasBoost) return null;

  const { during, before, delta, pct } = data.apps;
  const positive = delta > 0;
  const tone = positive
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
    : delta < 0
      ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
      : "border-white/10 bg-white/[0.03] text-slate-200";

  return (
    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-transparent p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-amber-100">
          {t("roi.title")}
          {data.active && (
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-1 text-xs uppercase tracking-wider text-amber-200">
              {t("roi.active")}
            </span>
          )}
        </div>
        <div className="text-[11px] text-amber-200/70">
          {t("roi.window", { n: data.periodDays })}{data.source ? ` · ${data.source}` : ""}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{t("roi.during")}</div>
          <div className="mt-0.5 text-xl font-semibold text-white">{during}</div>
          <div className="text-[10px] text-slate-500">{t("roi.apps")}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{t("roi.before")}</div>
          <div className="mt-0.5 text-xl font-semibold text-white">{before}</div>
          <div className="text-[10px] text-slate-500">{t("roi.prior", { n: data.periodDays })}</div>
        </div>
        <div className={`rounded-lg border p-2.5 ${tone}`}>
          <div className="text-[10px] uppercase tracking-wider opacity-70">{t("roi.delta")}</div>
          <div className="mt-0.5 text-xl font-semibold">
            {positive ? "+" : ""}
            {delta}
          </div>
          <div className="text-[10px] opacity-80">
            {pct !== null ? `${positive ? "+" : ""}${pct}%` : before === 0 ? t("roi.na") : "—"}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-amber-200/60">
        {t("roi.note")}
      </p>
    </div>
  );
}

function VacancyTeamNotes({ vacancyId }: { vacancyId: string }) {
  const { t } = useI18n();
  const { t: tb, dateTime } = useBuildT();
  type Note = Awaited<ReturnType<typeof buildApi.vacancyNotes>>["items"][number];
  const [items, setItems] = useState<Note[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  async function load() {
    try {
      const r = await buildApi.vacancyNotes(vacancyId);
      setItems(r.items);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (open && items === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const note = await buildApi.addVacancyNote(vacancyId, body);
      setItems((arr) => [
        { id: note.id, authorUserId: note.authorUserId, authorName: null, body: note.body, createdAt: note.createdAt },
        ...(arr ?? []),
      ]);
      setDraft("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(tb("notes.deleteConfirm"))) return;
    try {
      await buildApi.deleteVacancyNote(vacancyId, id);
      setItems((arr) => arr?.filter((n) => n.id !== id) ?? null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-slate-200"
      >
        <span>{tb("notes.title")} {items && items.length > 0 ? `(${items.length})` : ""}</span>
        <span className="text-xs text-slate-500">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <p className="mt-1 text-[11px] text-slate-500">
            {tb("notes.private")} {t("build.vacancyDetail.teamNotes.disclaimer")}
          </p>
          <div className="mt-3 flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={t("build.vacancyDetail.teamNotes.placeholder")}
              aria-label={t("build.vacancyDetail.teamNotes.placeholder")}
              className="flex-1 resize-none rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={!draft.trim() || busy}
              className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
            >
              {busy ? "…" : tb("common.add")}
            </button>
          </div>
          {items && items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="rounded-md border border-white/5 bg-black/20 p-2.5 text-xs"
                >
                  <div className="whitespace-pre-wrap text-slate-200">{n.body}</div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                    <span>
                      {n.authorName || n.authorUserId.slice(0, 8)} ·{" "}
                      {dateTime(n.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label={tb("notes.deleteAria")}
                      className="text-slate-500 hover:text-rose-300"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function VacancyTimeline({ vacancyId }: { vacancyId: string }) {
  const [events, setEvents] = useState<{
    kind: string;
    ts: string;
    title: string;
    meta?: Record<string, unknown>;
  }[] | null>(null);
  const [open, setOpen] = useState(false);
  const { t: tb, dateTime } = useBuildT();

  useEffect(() => {
    if (!open || events !== null) return;
    let cancelled = false;
    buildApi
      .vacancyTimeline(vacancyId)
      .then((r) => {
        if (!cancelled) setEvents(r.events);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, events, vacancyId]);

  const KIND_TONE: Record<string, { emoji: string; cls: string }> = {
    VACANCY_CREATED: { emoji: "🚀", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" },
    BOOST_STARTED: { emoji: "⚡", cls: "border-amber-400/40 bg-amber-400/10 text-amber-100" },
    BOOST_ENDED: { emoji: "💤", cls: "border-slate-400/30 bg-slate-400/5 text-slate-300" },
    APPLICATION_RECEIVED: { emoji: "📩", cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100" },
    APPLICATION_ACCEPTED: { emoji: "✓", cls: "border-emerald-400/40 bg-emerald-400/15 text-emerald-100" },
    APPLICATION_REJECTED: { emoji: "✗", cls: "border-rose-400/30 bg-rose-400/10 text-rose-100" },
    HIRE_FEE: { emoji: "💸", cls: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-100" },
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
      >
        <span>{tb("tl.title")}</span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {events === null ? (
            <p className="text-xs text-slate-500">{tb("common.loading")}</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-slate-500">{tb("tl.none")}</p>
          ) : (
            <ol className="space-y-2 border-l border-white/10 pl-3">
              {events.map((e, i) => {
                const t = KIND_TONE[e.kind] ?? { emoji: "•", cls: "border-white/10 bg-white/5 text-slate-200" };
                return (
                  <li key={i} className="relative">
                    <span className={`mr-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-xs ${t.cls}`}>
                      <span aria-hidden>{t.emoji}</span>
                    </span>
                    <span className="text-xs text-slate-200">{e.title}</span>
                    <span className="ml-2 text-[10px] text-slate-500">
                      {dateTime(e.ts)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function InviteCandidateBlock({ vacancyId }: { vacancyId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const validationError = emailError(email);
  const canSubmit = !busy && isEmail(email);
  const { t } = useBuildT();

  async function invite() {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    try {
      await buildApi.inviteCandidate(vacancyId, email.trim());
      setMsg({ ok: true, text: t("inv.sent", { email: email.trim() }) });
      setEmail("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{t("inv.title")}</div>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) invite();
          }}
          placeholder="candidate@email.com"
          aria-label={t("inv.emailAria")}
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
          {busy ? "…" : t("common.send")}
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

function ApplyRateChip({ views, apps }: { views: number; apps: number }) {
  const { t } = useBuildT();
  // Need at least 20 views before the ratio is meaningful — sub-20 is noise.
  if (views < 20 || apps === 0) return null;
  const pct = (apps / views) * 100;
  const tone =
    pct >= 8
      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
      : pct >= 3
        ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
        : "border-slate-400/30 bg-slate-400/10 text-slate-200";
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}
      title={t("rate.title", { apps, views })}
    >
      {t("rate.chip", { pct: pct.toFixed(1) })}
    </span>
  );
}

function VacancyExpiryBadge({
  expiresAt,
  status,
}: {
  expiresAt?: string | null;
  status: string;
}) {
  const { t, tn, date } = useBuildT();
  if (!expiresAt || status !== "OPEN") return null;
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days > 14) return null;
  if (days < 0) {
    return (
      <span className="rounded-full bg-rose-500/20 px-2 py-1 text-xs font-semibold text-rose-200">
        {t("exp.expired")}
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
      className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}
      title={t("common.closes", { date: date(expiresAt) })}
    >
      {days === 0 ? t("common.endsToday") : tn("common.daysLeft", days)}
    </span>
  );
}

function WhyMatchButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    explanation: string;
    skillsOverlap?: string[];
    skillsMissing?: string[];
    cached: boolean;
  } | null>(null);
  const toast = useToast();
  const { t } = useBuildT();

  async function load(force = false) {
    setBusy(true);
    try {
      const r = await buildApi.aiWhyMatch(applicationId, force);
      setData({
        explanation: r.explanation,
        skillsOverlap: r.skillsOverlap,
        skillsMissing: r.skillsMissing,
        cached: r.cached,
      });
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : load(false))}
        disabled={busy}
        className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
        title={t("why.title")}
      >
        {busy ? "…" : open ? t("why.hide") : t("why.btn")}
      </button>
      {open && data && (
        <div className="mt-2 w-full rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-50">
          <p className="whitespace-pre-wrap">{data.explanation}</p>
          {(data.skillsOverlap?.length || data.skillsMissing?.length) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.skillsOverlap?.map((s) => (
                <span key={`m-${s}`} className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                  ✓ {s}
                </span>
              ))}
              {data.skillsMissing?.map((s) => (
                <span key={`x-${s}`} className="rounded-full bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
                  ✗ {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-200/60">
            <span>{data.cached ? t("why.cached") : t("why.fresh")}</span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={busy}
              className="text-cyan-200 hover:text-white"
            >
              {t("why.regen")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function InterviewPrepButton({ applicationId }: { applicationId: string }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{
    questions: { q: string; hint: string }[];
    skillOverlap: string[];
    missingSkills: string[];
  } | null>(null);
  const toast = useToast();
  const { t } = useBuildT();

  async function run() {
    setBusy(true);
    try {
      const r = await buildApi.aiInterviewPrep(applicationId);
      setData(r);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    if (!data) return;
    const text = data.questions
      .map((qq, i) => `${i + 1}. ${qq.q}\n   (${qq.hint})`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("prep.copied"));
    } catch {
      toast.error(t("common.clipboardBlocked"));
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => (data ? setOpen((v) => !v) : run())}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
        title={t("prep.title")}
      >
        {busy ? t("prep.busy") : t("prep.btn")}
      </button>
      {open && data && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(440px,calc(100vw-2rem))] rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
              {t("prep.heading", { n: data.questions.length })}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAll}
                className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200"
                title={t("prep.copyTitle")}
              >
                {t("common.copy")}
              </button>
              <button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-[10px] text-slate-400 hover:text-slate-200">
                ×
              </button>
            </div>
          </div>
          {data.missingSkills.length > 0 && (
            <p className="mb-2 rounded border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1 text-[10px] text-amber-200">
              {t("prep.missing", { list: data.missingSkills.slice(0, 5).join(", ") })}
            </p>
          )}
          <ol className="space-y-2">
            {data.questions.map((qq, i) => (
              <li key={i} className="rounded border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] font-bold text-fuchsia-200">{i + 1}.</span>
                  <span className="flex-1 text-xs text-slate-200">{qq.q}</span>
                </div>
                <div className="mt-1 pl-5 text-[10px] italic text-slate-400">{qq.hint}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function AiShortlistButton({
  vacancyId,
  pendingCount,
  onLabel,
}: {
  vacancyId: string;
  pendingCount: number;
  onLabel: (applicationId: string, label: ApplicationLabel) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    summary: string;
    picks: { applicationId: string; rank: number; reasoning: string }[];
  } | null>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { t, st } = useBuildT();

  if (pendingCount === 0) return null;

  async function run() {
    setBusy(true);
    try {
      const r = await buildApi.aiShortlist(vacancyId);
      setResult({ summary: r.summary, picks: r.items });
      setOpen(true);
      if (r.items.length === 0) toast.info(t("sl.none"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyLabel(applicationId: string, rank: number) {
    const label: ApplicationLabel = rank === 1 ? "TOP_PICK" : "SHORTLIST";
    try {
      await buildApi.setApplicationLabel(applicationId, label);
      onLabel(applicationId, label);
      toast.success(t("sl.tagged", { label: st("label", label) }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (result ? setOpen((v) => !v) : run())}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
        title={t("sl.title")}
      >
        {busy ? t("sl.busy") : result ? t("sl.picks") : t("sl.btn", { n: pendingCount })}
      </button>
      {open && result && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
              {t("sl.heading")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                disabled={busy}
                className="text-[10px] text-slate-400 hover:text-slate-200"
                title={t("sl.rerun")}
                aria-label={t("sl.rerun")}
              >
                ⟳
              </button>
              <button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-[10px] text-slate-400 hover:text-slate-200">
                ×
              </button>
            </div>
          </div>
          {result.summary && (
            <p className="mb-2 rounded border border-white/5 bg-black/20 p-2 text-[11px] italic text-slate-300">
              {result.summary}
            </p>
          )}
          {result.picks.length === 0 ? (
            <p className="text-[11px] text-slate-500">{t("sl.noClear")}</p>
          ) : (
            <ul className="space-y-2">
              {result.picks.map((p) => (
                <li key={p.applicationId} className="rounded border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase text-fuchsia-200">
                      #{p.rank}
                    </span>
                    <button
                      onClick={() => applyLabel(p.applicationId, p.rank)}
                      className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-1 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/25"
                    >
                      {t("sl.tag", { label: st("label", p.rank === 1 ? "TOP_PICK" : "SHORTLIST") })}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-200">{p.reasoning}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BulkMessageButton({
  vacancyId,
  pendingCount,
}: {
  vacancyId: string;
  pendingCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<{ id: string; name: string; body: string }[] | null>(null);
  const toast = useToast();
  const { t: tb } = useBuildT();

  // Lazy-load templates the first time the dropdown opens.
  useEffect(() => {
    if (!open || templates !== null) return;
    buildApi
      .listBulkTemplates()
      .then((r) => setTemplates(r.items))
      .catch(() => setTemplates([]));
  }, [open, templates]);

  if (pendingCount === 0) return null;

  async function send() {
    const body = content.trim();
    if (body.length < 5) {
      toast.error(tb("bm.short"));
      return;
    }
    if (!confirm(tb("bm.confirm", { n: pendingCount }))) return;
    setBusy(true);
    try {
      const r = await buildApi.bulkMessageApplicants(vacancyId, body, "PENDING");
      toast.success(tb("bm.sent", { n: r.sent }));
      setContent("");
      setOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    const body = content.trim();
    if (body.length < 5) return;
    const name = window.prompt(tb("bm.tplPrompt"), body.slice(0, 40));
    if (!name?.trim()) return;
    try {
      const t = await buildApi.saveBulkTemplate({ name: name.trim(), body });
      setTemplates((arr) => (arr ? [t, ...arr] : [t]));
      toast.success(tb("bm.tplSaved"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeTemplate(id: string) {
    try {
      await buildApi.deleteBulkTemplate(id);
      setTemplates((arr) => arr?.filter((t) => t.id !== id) ?? arr);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
        title={tb("bm.btnTitle")}
      >
        {tb("bm.btn", { n: pendingCount })}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-lg border border-white/10 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
            {tb("bm.heading", { n: pendingCount })}
          </div>
          {templates && templates.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {templates.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => setContent(t.body)}
                    title={t.body}
                    className="hover:underline"
                  >
                    {t.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTemplate(t.id)}
                    aria-label={tb("bm.tplDeleteAria", { name: t.name })}
                    className="text-slate-500 hover:text-rose-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={tb("bm.ph")}
            aria-label={tb("bm.heading", { n: pendingCount })}
            className="w-full rounded border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={saveAsTemplate}
              disabled={content.trim().length < 5}
              className="text-[10px] text-slate-400 hover:text-emerald-300 disabled:opacity-40"
              title={tb("bm.tplTitle")}
            >
              {tb("bm.saveTpl")}
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-slate-300 hover:bg-white/5"
              >
                {tb("common.cancel")}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={busy || content.trim().length < 5}
                className="rounded-md bg-sky-500 px-3 py-1 text-[11px] font-semibold text-sky-950 hover:bg-sky-400 disabled:opacity-50"
              >
                {busy ? "…" : tb("common.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VacancyFeedbackButton({ vacancyId }: { vacancyId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof buildApi.aiVacancyFeedback>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { t } = useBuildT();

  async function run() {
    setOpen(true);
    if (data || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await buildApi.aiVacancyFeedback(vacancyId);
      setData(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tone =
    !data
      ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-100"
      : data.score >= 80
        ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
        : data.score >= 50
          ? "border-amber-400/40 bg-amber-400/15 text-amber-100"
          : "border-rose-400/40 bg-rose-400/15 text-rose-100";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        title={t("fb.title")}
        className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90 disabled:opacity-50 ${tone}`}
      >
        {busy ? "…" : data ? `🤖 ${data.score}/100` : t("fb.btn")}
      </button>
      {open && (data || err) && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-xl border border-white/10 bg-slate-900 p-4 text-xs shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-white">{t("fb.heading")}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.close")}
              className="text-slate-500 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          {err && <p className="text-rose-300">{err}</p>}
          {data && (
            <>
              <div className="mb-2 flex items-baseline gap-2">
                <div className="text-3xl font-bold text-white">{data.score}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">/ 100</div>
              </div>
              {data.strengths.length > 0 && (
                <>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    {t("fb.strengths")}
                  </div>
                  <ul className="mb-2 space-y-0.5 pl-4 text-slate-300">
                    {data.strengths.map((s, i) => (
                      <li key={i} className="list-disc">{s}</li>
                    ))}
                  </ul>
                </>
              )}
              {data.suggestions.length > 0 && (
                <>
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    {t("fb.suggestions")}
                  </div>
                  <ul className="space-y-0.5 pl-4 text-slate-300">
                    {data.suggestions.map((s, i) => (
                      <li key={i} className="list-disc">{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TranslateVacancyButton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, { title: string; description: string }> | null>(null);
  const [activeLoc, setActiveLoc] = useState<string>("en");
  const toast = useToast();
  const { t } = useBuildT();

  async function run() {
    setBusy(true);
    try {
      const r = await buildApi.aiTranslateVacancy({ title, description });
      setData(r.translations);
      const first = Object.keys(r.translations)[0];
      if (first) setActiveLoc(first);
      setOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!data?.[activeLoc]) return;
    const text = `${data[activeLoc].title}\n\n${data[activeLoc].description}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.clipboardBlocked"));
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (data ? setOpen((v) => !v) : run())}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
        title={t("tr.title")}
      >
        {busy ? t("tr.busy") : t("tr.btn")}
      </button>
      {open && data && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(560px,calc(100vw-2rem))] rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {Object.keys(data).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setActiveLoc(loc)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                    activeLoc === loc ? "bg-fuchsia-500/20 text-fuchsia-100" : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copy} className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200">
                {t("common.copy")}
              </button>
              <button onClick={() => setOpen(false)} aria-label={t("common.close")} className="text-[10px] text-slate-400 hover:text-slate-200">
                ×
              </button>
            </div>
          </div>
          <div className="rounded border border-white/10 bg-black/20 p-2">
            <div className="mb-2 text-sm font-semibold text-white">{data[activeLoc]?.title}</div>
            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-xs text-slate-200">
              {data[activeLoc]?.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DeleteVacancyButton({
  vacancyId,
  projectId,
}: {
  vacancyId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function del() {
    if (
      !confirm(
        t("del.confirm"),
      )
    ) return;
    setBusy(true);
    try {
      await buildApi.deleteVacancy(vacancyId);
      toast.success(t("del.done"));
      router.push(`/build/project/${encodeURIComponent(projectId)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      title={t("del.title")}
      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
    >
      {busy ? "…" : t("del.btn")}
    </button>
  );
}

function ExportCsvButton({
  vacancyId,
  vacancyTitle,
}: {
  vacancyId: string;
  vacancyTitle: string;
}) {
  const token = useBuildAuth((s) => s.token);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function download() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/build/applications/by-vacancy/${encodeURIComponent(vacancyId)}/export.csv`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = vacancyTitle.replace(/[^a-z0-9а-яё]+/giu, "-").toLowerCase().replace(/^-+|-+$/g, "").slice(0, 40);
      a.download = `applications-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(t("csv.failed", { err: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title={t("csv.title")}
      className="rounded-md border border-white/10 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : "↓ CSV"}
    </button>
  );
}

function ArchiveVacancyButton({
  vacancyId,
  onDone,
}: {
  vacancyId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function archive() {
    if (!confirm(t("arch.confirm"))) return;
    setBusy(true);
    try {
      await buildApi.patchVacancy(vacancyId, { status: "ARCHIVED" });
      toast.success(t("arch.done"));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={archive}
      disabled={busy}
      title={t("arch.title")}
      className="rounded-md border border-slate-500/40 bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-500/20 disabled:opacity-50"
    >
      {busy ? "…" : t("arch.btn")}
    </button>
  );
}

function RepublishVacancyButton({
  vacancyId,
  onDone,
}: {
  vacancyId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function republish() {
    if (!confirm(t("rep.confirm"))) return;
    setBusy(true);
    try {
      await buildApi.republishVacancy(vacancyId);
      toast.success(t("rep.done"));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={republish}
      disabled={busy}
      title={t("rep.title")}
      className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
    >
      {busy ? "…" : t("rep.btn")}
    </button>
  );
}

function ExtendVacancyButton({
  vacancyId,
  onDone,
}: {
  vacancyId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t, date } = useBuildT();

  async function extend() {
    setBusy(true);
    try {
      const r = await buildApi.extendVacancy(vacancyId, 30);
      toast.success(t("ext.done", { date: date(r.newExpiresAt), n: r.extendedDays }));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={extend}
      disabled={busy}
      title={t("ext.title")}
      className="rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25 disabled:opacity-50"
    >
      {busy ? "…" : t("ext.btn")}
    </button>
  );
}

function SaveAsTemplateButton({ vacancy }: { vacancy: BuildVacancy }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function save() {
    const name = prompt(t("tpl.prompt"));
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await buildApi.saveVacancyTemplate({
        name: name.trim(),
        title: vacancy.title,
        description: vacancy.description,
        skills: vacancy.skills,
        salary: vacancy.salary,
        salaryCurrency: vacancy.salaryCurrency,
        city: vacancy.city,
        questions: vacancy.questions,
      });
      toast.success(t("tpl.done"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy}
      title={t("tpl.title")}
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : t("tpl.btn")}
    </button>
  );
}

function CloneVacancyButton({
  vacancyId,
  projectId,
}: {
  vacancyId: string;
  projectId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = useBuildT();

  async function clone() {
    setBusy(true);
    try {
      const r = await buildApi.duplicateVacancy(vacancyId, projectId);
      toast.success(t("clone.done"));
      router.push(`/build/vacancy/${encodeURIComponent(r.id)}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={clone}
      disabled={busy}
      title={t("clone.title")}
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : t("clone.btn")}
    </button>
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
  const { t } = useBuildT();
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
      {busy ? "…" : isOpen ? t("toggle.close") : t("toggle.reopen")}
    </button>
  );
}

function UrgentToggleButton({ vacancy, onDone }: { vacancy: BuildVacancy & { urgent?: boolean; urgentUntil?: string | null }; onDone: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const isUrgent = !!vacancy.urgent && (!vacancy.urgentUntil || new Date(vacancy.urgentUntil) > new Date());

  async function toggle() {
    setBusy(true);
    try {
      await buildApi.setVacancyUrgent(vacancy.id, { urgent: !isUrgent });
      onDone();
    } catch {/* ignore */}
    finally { setBusy(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={isUrgent ? t("build.vacancyDetail.urgent.remove") : t("build.vacancyDetail.urgent.mark")}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        isUrgent
          ? "border border-red-500/50 bg-red-500/20 text-red-200 hover:bg-red-500/10"
          : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {busy ? "…" : isUrgent ? t("build.vacancyDetail.urgent.onLabel") : t("build.vacancyDetail.urgent.label")}
    </button>
  );
}
