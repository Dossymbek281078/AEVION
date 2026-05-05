"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { emailError, isEmail } from "@/lib/build/validate";
import { useToast } from "@/components/build/Toast";
import { VacancyDetailSkeleton } from "@/components/build/Skeleton";
import { recordVacancyView } from "@/lib/build/recentlyViewed";

export default function VacancyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useBuildAuth((s) => s.user);

  const [vacancy, setVacancy] = useState<BuildVacancy | null>(null);
  const [applications, setApplications] = useState<BuildApplication[] | null>(null);
  const [myApplied, setMyApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelFilter, setLabelFilter] = useState<ApplicationLabel | "ALL">("ALL");
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
            {vacancy.viewCount != null && vacancy.viewCount >= 5 && (
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
            <div className="flex flex-col items-end gap-1.5">
              <VacancyStatusToggle
                vacancyId={vacancy.id}
                currentStatus={vacancy.status}
                onToggled={refresh}
              />
              <div className="flex flex-wrap justify-end gap-1.5">
                <CloneVacancyButton
                  vacancyId={vacancy.id}
                  projectId={vacancy.projectId}
                />
                <SaveAsTemplateButton vacancy={vacancy} />
                {vacancy.status === "CLOSED" && (
                  <RepublishVacancyButton
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
                Role description
              </h2>
              {isOwner && (
                <TranslateVacancyButton
                  title={vacancy.title}
                  description={vacancy.description}
                />
              )}
            </div>
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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShortcutsHelpOpen(true)}
                      className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-mono text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
                      title="Keyboard shortcuts (?)"
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
                  No applications yet.
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
                  {(() => {
                    const filtered = applications.filter((a) => {
                      if (labelFilter === "ALL") return true;
                      return a.labelKey === labelFilter;
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
                                aria-label={`Select ${a.applicantName ?? "application"}`}
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
                              No applications match this label filter.
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

          {isOwner && <VacancyTimeline vacancyId={vacancy.id} />}

          {isOwner && <EmbedSnippetBlock vacancyId={vacancy.id} />}

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

      {!isOwner && <SimilarVacancies vacancyId={vacancy.id} />}

      {shortcutsHelpOpen && (
        <KeyboardShortcutsHelp onClose={() => setShortcutsHelpOpen(false)} />
      )}
    </BuildShell>
  );
}

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["j"], label: "Next application" },
    { keys: ["k"], label: "Previous application" },
    { keys: ["a"], label: "Accept focused" },
    { keys: ["r"], label: "Reject focused" },
    { keys: ["t"], label: "Tag TOP_PICK" },
    { keys: ["s"], label: "Tag SHORTLIST" },
    { keys: ["i"], label: "Tag INTERVIEW" },
    { keys: ["h"], label: "Tag HOLD" },
    { keys: ["?"], label: "Toggle this overlay" },
    { keys: ["Esc"], label: "Close" },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-[min(420px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            ⌨ Keyboard shortcuts
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">×</button>
        </div>
        <ul className="space-y-1.5 text-sm">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3">
              <div className="flex gap-1">
                {r.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[11px] font-mono text-slate-200"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
              <span className="text-slate-300">{r.label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">
          Shortcuts only fire when no input or textarea is focused.
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
        <h2 className="text-lg font-semibold text-white">Similar vacancies</h2>
        <Link href="/build/vacancies" className="text-xs text-emerald-300 hover:underline">
          See all →
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
                {v.salary > 0 ? `$${v.salary.toLocaleString()}` : "—"}
              </div>
            </div>
            {v.overlapSkills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {v.overlapSkills.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200"
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
              {v.projectCity && <span>📍 {v.projectCity}</span>}
              {v.overlapCount > 0 && (
                <span className="text-emerald-300/80">{v.overlapCount} skill match</span>
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
            {app.sourceTag && (
              <span
                className="rounded bg-slate-500/20 px-1.5 py-0.5 text-[10px] text-slate-300"
                title={`Source: ${app.sourceTag}`}
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
                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200"
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
            {app.status}
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
          title="Open full-screen review (←/→ to navigate)"
        >
          🔍 Review
        </Link>
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
              previousStatusRef.current = app.status;
              onOptimistic?.("ACCEPTED");
              setBusy(true);
              try {
                const r = await buildApi.updateApplication(app.id, "ACCEPTED");
                if (r.hireOrder && r.hireOrder.amount > 0) {
                  toast.success(
                    `Кандидат принят. Hire fee: ${r.hireOrder.amount.toLocaleString()} ${r.hireOrder.currency} — оплатите в «Settings → Orders».`,
                  );
                } else {
                  toast.success("Candidate accepted.");
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
            Accept
          </button>
        )}
        {app.status !== "REJECTED" && (
          <button
            disabled={busy}
            onClick={async () => {
              const reason = prompt("Reason for rejection (optional, shown to candidate):");
              previousStatusRef.current = app.status;
              onOptimistic?.("REJECTED");
              setBusy(true);
              try {
                await buildApi.updateApplication(app.id, "REJECTED", reason?.trim() || undefined);
                toast.info("Candidate rejected.");
                onChanged();
              } catch (err) {
                onOptimistic?.(previousStatusRef.current);
                toast.error((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-rose-500/20 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            Reject
          </button>
        )}
        <InterviewPrepButton applicationId={app.id} />
        <WhyMatchButton applicationId={app.id} />
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
      <RecruiterNotes applicationId={app.id} />
    </li>
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
  if (labelled.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">Filter by label:</span>
      <button
        onClick={() => onChange("ALL")}
        className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
          value === "ALL" ? "bg-white/15 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
        }`}
      >
        All ({applications.length})
      </button>
      {(["TOP_PICK", "SHORTLIST", "INTERVIEW", "HOLD"] as ApplicationLabel[]).map((l) => {
        const n = counts[l] ?? 0;
        if (n === 0) return null;
        const active = value === l;
        return (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
              active ? LABEL_TONE[l] : "border-transparent bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {LABEL_EMOJI[l]} {l} ({n})
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
  if (selectedIds.length === 0) return null;

  async function bulk(status: "ACCEPTED" | "REJECTED") {
    if (
      !confirm(
        status === "ACCEPTED"
          ? `Accept ${selectedIds.length} application${selectedIds.length === 1 ? "" : "s"}? They will be notified by email. (No hire fee from bulk — fee fires only from the per-row Accept.)`
          : `Reject ${selectedIds.length} application${selectedIds.length === 1 ? "" : "s"}?`,
      )
    ) return;
    let reason: string | undefined;
    if (status === "REJECTED") {
      const r = prompt("Reason (optional, shown to candidate):") ?? "";
      reason = r.trim() || undefined;
    }
    setBusy(true);
    onOptimistic(selectedIds, status);
    try {
      const r = await buildApi.bulkUpdateApplicationStatus(selectedIds, status, reason);
      toast.success(`${r.updated} updated${r.skipped.length > 0 ? `, ${r.skipped.length} skipped` : ""}`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-3 py-2 text-xs">
      <span className="font-semibold text-emerald-200">{selectedIds.length} selected</span>
      <span className="text-slate-500">·</span>
      <button
        onClick={() => bulk("ACCEPTED")}
        disabled={busy}
        className="rounded-md bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        Bulk accept
      </button>
      <button
        onClick={() => bulk("REJECTED")}
        disabled={busy}
        className="rounded-md bg-rose-500/20 px-3 py-1 font-semibold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
      >
        Bulk reject
      </button>
      <button
        onClick={onClear}
        className="ml-auto text-[11px] text-slate-400 hover:text-slate-200"
      >
        Clear
      </button>
    </div>
  );
}

const LABEL_TONE: Record<ApplicationLabel, string> = {
  TOP_PICK: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-100",
  SHORTLIST: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  INTERVIEW: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  HOLD: "border-amber-500/40 bg-amber-500/10 text-amber-200",
};
const LABEL_EMOJI: Record<ApplicationLabel, string> = {
  TOP_PICK: "★",
  SHORTLIST: "✓",
  INTERVIEW: "📞",
  HOLD: "⏸",
};
const LABEL_OPTIONS: ApplicationLabel[] = ["TOP_PICK", "SHORTLIST", "INTERVIEW", "HOLD"];

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
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
          current ? LABEL_TONE[current] : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
        }`}
        title="Recruiter label (private)"
      >
        {current ? `${LABEL_EMOJI[current]} ${current}` : "+ Label"}
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
              {LABEL_EMOJI[l]} {l}
            </button>
          ))}
          {current && (
            <button
              type="button"
              onClick={() => set(null)}
              className="mt-0.5 block w-full rounded border-t border-white/5 px-2 py-1 text-left text-[11px] text-slate-500 hover:bg-white/5 hover:text-rose-300"
            >
              ✕ Clear label
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
        {open ? "▼" : "▶"} Private notes {loaded && items.length > 0 ? `(${items.length})` : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={4000}
              placeholder="Private note (only you and admins see this)…"
              className="flex-1 rounded border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-slate-500 focus:border-amber-500/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !draft.trim()}
              className="self-start rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {busy ? "…" : "Add"}
            </button>
          </div>
          {!loaded ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-[11px] text-slate-500">No notes yet — first one logs the impression you don&apos;t want to forget by next interview.</p>
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
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    <span className="flex items-center gap-2">
                      <button
                        onClick={() => togglePin(n.id, !n.isPinned)}
                        className={n.isPinned ? "text-amber-300 hover:text-amber-200" : "hover:text-slate-300"}
                        title={n.isPinned ? "Unpin" : "Pin to top"}
                      >
                        {n.isPinned ? "Unpin" : "Pin"}
                      </button>
                      <button onClick={() => remove(n.id)} className="hover:text-rose-300">
                        Delete
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

function EmbedSnippetBlock({ vacancyId }: { vacancyId: string }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const origin = typeof window !== "undefined" ? window.location.origin : "https://aevion.tech";
  const snippet = `<div data-aevion-build data-key="qb_pk_..." data-vacancy-id="${vacancyId}"></div>
<script src="${origin}/api/build/public/widget.js" defer></script>`;

  function copy() {
    navigator.clipboard.writeText(snippet).then(
      () => toast.success("Embed snippet copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Embed on your site
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-white/10"
        >
          {open ? "Hide" : "Show snippet"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            Drop this on any website. Replace <code className="rounded bg-black/40 px-1 text-emerald-200">qb_pk_...</code> with a partner key from{" "}
            <Link href="/build/admin/partner-keys" className="text-emerald-300 underline">
              admin → partner keys
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
            📋 Copy snippet
          </button>
        </div>
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
        <span>Activity timeline</span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3">
          {events === null ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-slate-500">No events yet.</p>
          ) : (
            <ol className="space-y-2 border-l border-white/10 pl-3">
              {events.map((e, i) => {
                const t = KIND_TONE[e.kind] ?? { emoji: "•", cls: "border-white/10 bg-white/5 text-slate-200" };
                return (
                  <li key={i} className="relative">
                    <span className={`mr-2 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${t.cls}`}>
                      <span aria-hidden>{t.emoji}</span>
                    </span>
                    <span className="text-xs text-slate-200">{e.title}</span>
                    <span className="ml-2 text-[10px] text-slate-500">
                      {new Date(e.ts).toLocaleString()}
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
        title="Claude explains why this candidate matches"
      >
        {busy ? "…" : open ? "Hide ✨" : "✨ Why match?"}
      </button>
      {open && data && (
        <div className="mt-2 w-full rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs text-cyan-50">
          <p className="whitespace-pre-wrap">{data.explanation}</p>
          {(data.skillsOverlap?.length || data.skillsMissing?.length) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {data.skillsOverlap?.map((s) => (
                <span key={`m-${s}`} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                  ✓ {s}
                </span>
              ))}
              {data.skillsMissing?.map((s) => (
                <span key={`x-${s}`} className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] text-rose-200">
                  ✗ {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between text-[10px] text-cyan-200/60">
            <span>{data.cached ? "Cached — click 🔄 to regenerate" : "Generated just now"}</span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={busy}
              className="text-cyan-200 hover:text-white"
            >
              🔄 Regenerate
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
      toast.success("Copied questions");
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => (data ? setOpen((v) => !v) : run())}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20 disabled:opacity-50"
        title="Claude drafts 5 interview questions tailored to this candidate + role"
      >
        {busy ? "✨ prepping…" : "✨ Interview prep"}
      </button>
      {open && data && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(440px,calc(100vw-2rem))] rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
              Interview prep · {data.questions.length} questions
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={copyAll}
                className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200"
                title="Copy all to clipboard"
              >
                ⎘ copy
              </button>
              <button onClick={() => setOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-200">
                ×
              </button>
            </div>
          </div>
          {data.missingSkills.length > 0 && (
            <p className="mb-2 rounded border border-amber-500/20 bg-amber-500/[0.06] px-2 py-1 text-[10px] text-amber-200">
              ⚠ Missing skills: {data.missingSkills.slice(0, 5).join(", ")}
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

  if (pendingCount === 0) return null;

  async function run() {
    setBusy(true);
    try {
      const r = await buildApi.aiShortlist(vacancyId);
      setResult({ summary: r.summary, picks: r.items });
      setOpen(true);
      if (r.items.length === 0) toast.info("No clear top picks among pending applicants.");
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
      toast.success(`Tagged as ${label}`);
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
        title="Claude reads all pending applications and picks the top 3"
      >
        {busy ? "✨ analysing…" : result ? "✨ AI picks" : `✨ AI shortlist (${pendingCount})`}
      </button>
      {open && result && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-200">
              Claude shortlist
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={run}
                disabled={busy}
                className="text-[10px] text-slate-400 hover:text-slate-200"
                title="Re-run"
              >
                ⟳
              </button>
              <button onClick={() => setOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-200">
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
            <p className="text-[11px] text-slate-500">Claude couldn&apos;t identify clear top picks.</p>
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
                      className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-200 hover:bg-fuchsia-500/25"
                    >
                      Tag {p.rank === 1 ? "TOP_PICK" : "SHORTLIST"}
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
  const toast = useToast();

  if (pendingCount === 0) return null;

  async function send() {
    const body = content.trim();
    if (body.length < 5) {
      toast.error("Message is too short.");
      return;
    }
    if (!confirm(`Send this DM to all ${pendingCount} PENDING applicants?`)) return;
    setBusy(true);
    try {
      const r = await buildApi.bulkMessageApplicants(vacancyId, body, "PENDING");
      toast.success(`Sent to ${r.sent} applicant${r.sent === 1 ? "" : "s"}.`);
      setContent("");
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
        className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/20"
        title="Send the same DM to every PENDING applicant on this vacancy"
      >
        ✉ Message all ({pendingCount})
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-lg border border-white/10 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200">
            Message {pendingCount} pending applicants
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="Hi, thanks for applying — I'd like to schedule a 15-min call this week. Free Tue/Wed afternoon?"
            className="w-full rounded border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-500/40 focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-white/10 px-3 py-1 text-[11px] text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy || content.trim().length < 5}
              className="rounded-md bg-sky-500 px-3 py-1 text-[11px] font-semibold text-sky-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? "…" : "Send"}
            </button>
          </div>
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
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (data ? setOpen((v) => !v) : run())}
        disabled={busy}
        className="rounded-md border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-50"
        title="Claude generates RU/EN/KK variants of this vacancy"
      >
        {busy ? "✨ translating…" : "✨ Translate"}
      </button>
      {open && data && (
        <div className="absolute right-0 top-full z-30 mt-1 w-[min(560px,calc(100vw-2rem))] rounded-lg border border-fuchsia-500/30 bg-slate-900 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex gap-1">
              {Object.keys(data).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setActiveLoc(loc)}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    activeLoc === loc ? "bg-fuchsia-500/20 text-fuchsia-100" : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={copy} className="text-[10px] text-fuchsia-300 hover:text-fuchsia-200">
                ⎘ copy
              </button>
              <button onClick={() => setOpen(false)} className="text-[10px] text-slate-400 hover:text-slate-200">
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

  async function del() {
    if (
      !confirm(
        "Permanently delete this vacancy? This is only allowed when no applications exist. Otherwise close the vacancy instead.",
      )
    ) return;
    setBusy(true);
    try {
      await buildApi.deleteVacancy(vacancyId);
      toast.success("Vacancy deleted");
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
      title="Permanently delete (only when 0 applications)"
      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
    >
      {busy ? "…" : "🗑 Delete"}
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
      const slug = vacancyTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase().slice(0, 40);
      a.download = `applications-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(`CSV download failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      title="Download all applications as CSV (includes label, skills, AI score)"
      className="rounded-md border border-white/10 px-3 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : "↓ CSV"}
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

  async function republish() {
    if (!confirm("Reopen this vacancy? Status will return to OPEN and expiry will reset to 30 days from now.")) return;
    setBusy(true);
    try {
      await buildApi.republishVacancy(vacancyId);
      toast.success("Vacancy reopened — expiry reset to 30 days");
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
      title="Reopen this vacancy and reset expiry"
      className="rounded-md border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/25 disabled:opacity-50"
    >
      {busy ? "…" : "↻ Reopen"}
    </button>
  );
}

function SaveAsTemplateButton({ vacancy }: { vacancy: BuildVacancy }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    const name = prompt("Template name (e.g. 'Senior welder · Astana'):");
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
      toast.success("Saved as template — pick it on the next vacancy you post.");
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
      title="Save the current vacancy as a reusable template"
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : "★ Template"}
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

  async function clone() {
    setBusy(true);
    try {
      const r = await buildApi.duplicateVacancy(vacancyId, projectId);
      toast.success("Vacancy cloned. Edit the copy and re-publish.");
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
      title="Create a draft copy of this vacancy in the same project"
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
    >
      {busy ? "…" : "⎘ Clone"}
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
