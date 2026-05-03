"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { VacancyCard } from "@/components/build/VacancyCard";
import { AiImprove } from "@/components/build/AiImprove";
import {
  EligibleReviewsBlock,
  ReviewsByProjectSection,
} from "@/components/build/ReviewsSection";
import {
  buildApi,
  type BuildVacancy,
  type BuildProject,
  type BuildFile,
  type ProjectStatus,
} from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

const STATUSES: ProjectStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

type ProjectBundle = {
  project: BuildProject;
  vacancies: BuildVacancy[];
  files: BuildFile[];
  client: { id: string; email: string; name: string } | null;
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useBuildAuth((s) => s.user);

  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    buildApi
      .getProject(id)
      .then((r) => setBundle(r as ProjectBundle))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-slate-400">Loading project…</p>
      </BuildShell>
    );
  }
  if (error || !bundle) {
    return (
      <BuildShell>
        <p className="py-8 text-sm text-rose-300">{error || "Project not found."}</p>
        <Link href="/build" className="text-sm text-emerald-300 underline">
          ← Back to projects
        </Link>
      </BuildShell>
    );
  }

  const { project, vacancies, files, client } = bundle;
  const isOwner = me?.id === project.clientId;

  return (
    <BuildShell>
      <Link href="/build" className="text-xs text-slate-400 underline-offset-2 hover:underline">
        ← All projects
      </Link>

      <div className="mt-2 mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
            <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
            {project.city && <span>· {project.city}</span>}
            {project.budget > 0 && <span>· Budget ${project.budget.toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ShareButton projectId={project.id} />
          {isOwner && project.status !== "DONE" && (
            <ProjectStatusButton
              projectId={project.id}
              currentStatus={project.status}
              onUpdated={refresh}
            />
          )}
          {client && (
            <div className="text-right text-xs text-slate-400">
              <div>Posted by</div>
              <div className="text-sm font-medium text-slate-200">{client.name}</div>
              <div>{client.email}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-slate-200">{project.description}</p>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Vacancies <span className="text-slate-500">({vacancies.length})</span>
              </h2>
              {isOwner && <NewVacancyButton projectId={project.id} onCreated={refresh} />}
            </div>
            {vacancies.length === 0 ? (
              <p className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
                No vacancies yet.{" "}
                {isOwner ? "Add one above to start receiving applications." : "Check back later."}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {vacancies.map((v) => (
                  <div key={v.id} className="space-y-1.5">
                    <VacancyCard vacancy={v} />
                    {isOwner && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <VacancyBoostButton vacancy={v} onUpdated={refresh} />
                        <VacancyOwnerToggle vacancy={v} onUpdated={refresh} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-lg font-semibold text-white">Files</h2>
              <ul className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-emerald-300 hover:underline"
                    >
                      {f.name || f.url}
                    </a>
                    <span className="text-xs text-slate-500">
                      {f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(0)} KB` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-wider text-slate-400">Status</div>
            <div className="mt-2 text-2xl font-semibold text-white">{project.status}</div>
            {isOwner && <OwnerStatusControls project={project} onUpdated={refresh} />}
          </div>

          {isOwner && <OwnerFileUpload projectId={project.id} onUploaded={refresh} />}
        </aside>
      </div>

      {me && <EligibleReviewsBlock scopeProjectId={project.id} />}
      <ReviewsByProjectSection projectId={project.id} />
    </BuildShell>
  );
}

function ShareButton({ projectId }: { projectId: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(() => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/build/p/${projectId}`
        : `/build/p/${projectId}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        })
        .catch(() => {});
    }
  }, [projectId]);
  return (
    <button
      onClick={onClick}
      title="Copy public link to clipboard"
      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
    >
      {copied ? "✓ Link copied" : "🔗 Share"}
    </button>
  );
}

function VacancyBoostButton({
  vacancy,
  onUpdated,
}: {
  vacancy: BuildVacancy;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isFeatured = !!vacancy.boostUntil && new Date(vacancy.boostUntil) > new Date();
  return (
    <button
      disabled={busy || vacancy.status !== "OPEN"}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isFeatured) return;
        if (!confirm("Boost this vacancy for 7 days? Free if your plan has boosts left, otherwise creates a 990 ₽ pending order.")) {
          return;
        }
        setBusy(true);
        try {
          const r = await buildApi.boostVacancy(vacancy.id, 7);
          onUpdated();
          alert(
            r.source === "PLAN"
              ? "Boost activated! Vacancy is now featured for 7 days."
              : `Boost recorded as a pending order (id ${r.orderId?.slice(0, 8)}…). Pay it on the Pricing page to activate.`,
          );
        } catch (err) {
          alert((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      title={isFeatured ? `Featured until ${new Date(vacancy.boostUntil!).toLocaleDateString()}` : "Boost this vacancy for 7 days"}
      className={`w-full rounded-md px-2.5 py-1 text-xs ${
        isFeatured
          ? "bg-amber-500/15 text-amber-200"
          : "bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
      } disabled:opacity-50`}
    >
      {busy ? "…" : isFeatured ? "★ Featured" : "★ Boost 7d"}
    </button>
  );
}

function VacancyOwnerToggle({
  vacancy,
  onUpdated,
}: {
  vacancy: BuildVacancy;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isClosed = vacancy.status === "CLOSED";
  return (
    <button
      disabled={busy}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        try {
          await buildApi.updateVacancy(vacancy.id, isClosed ? "OPEN" : "CLOSED");
          onUpdated();
        } finally {
          setBusy(false);
        }
      }}
      className={`w-full rounded-md px-2.5 py-1 text-xs ${
        isClosed
          ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
          : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {busy ? "…" : isClosed ? "↻ Reopen vacancy" : "✕ Close vacancy"}
    </button>
  );
}

function OwnerStatusControls({
  project,
  onUpdated,
}: {
  project: BuildProject;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 flex flex-wrap gap-1">
      {STATUSES.map((s) => (
        <button
          key={s}
          disabled={busy || project.status === s}
          onClick={async () => {
            setBusy(true);
            try {
              await buildApi.updateProject(project.id, { status: s });
              onUpdated();
            } finally {
              setBusy(false);
            }
          }}
          className={`rounded-md px-2.5 py-1 text-xs ${
            project.status === s
              ? "bg-emerald-500/20 text-emerald-200"
              : "bg-white/5 text-slate-300 hover:bg-white/10"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function NewVacancyButton({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [salary, setSalary] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionInput, setQuestionInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSkill() {
    const v = skillInput.trim();
    if (!v || skills.includes(v)) {
      setSkillInput("");
      return;
    }
    setSkills([...skills, v].slice(0, 30));
    setSkillInput("");
  }

  function addQuestion() {
    const v = questionInput.trim();
    if (!v || questions.includes(v)) {
      setQuestionInput("");
      return;
    }
    setQuestions([...questions, v].slice(0, 5));
    setQuestionInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await buildApi.createVacancy({
        projectId,
        title: title.trim(),
        description: description.trim(),
        salary: salary ? Number(salary) : undefined,
        skills,
        questions,
      });
      setOpen(false);
      setTitle("");
      setDescription("");
      setSalary("");
      setSkills([]);
      setQuestions([]);
      onCreated();
    } catch (e) {
      const apiErr = e as { code?: string; payload?: Record<string, unknown> };
      if (apiErr.code === "plan_vacancy_limit_reached") {
        setError(
          `Plan limit reached: ${apiErr.payload?.used}/${apiErr.payload?.limit} active vacancies. Upgrade your plan on /build/pricing.`,
        );
      } else {
        setError((e as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
      >
        + Add vacancy
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Role title (e.g. Welder, day shift)"
        required
        minLength={3}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Requirements, schedule, equipment provided…"
        required
        minLength={10}
        rows={3}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <AiImprove
        value={description}
        onAccept={(v) => setDescription(v)}
        kind="vacancy_description"
        hint="Сделать описание вакансии конкретнее"
      />
      <input
        type="number"
        min={0}
        step="any"
        value={salary}
        onChange={(e) => setSalary(e.target.value)}
        placeholder="Monthly salary (USD, optional)"
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <div className="rounded-md border border-white/10 bg-white/5 p-2">
        <div className="mb-1 text-xs text-slate-400">Required skills (Enter to add — used for match score)</div>
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-200"
            >
              {s}
              <button
                type="button"
                onClick={() => setSkills(skills.filter((x) => x !== s))}
                className="text-emerald-200/60 hover:text-emerald-200"
                aria-label={`Remove ${s}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addSkill();
              }
            }}
            onBlur={addSkill}
            placeholder={skills.length === 0 ? "Welding, AutoCAD…" : ""}
            className="flex-1 min-w-[100px] bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="rounded-md border border-fuchsia-500/20 bg-fuchsia-500/5 p-2">
        <div className="mb-1 text-xs text-fuchsia-200/80">
          Quick questions for applicants (max 5) — Claude will score answers automatically ✨
        </div>
        <div className="space-y-1.5">
          {questions.map((q, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-md bg-fuchsia-500/10 px-2 py-1 text-xs text-fuchsia-100"
            >
              <span className="font-mono text-fuchsia-300/70">Q{i + 1}.</span>
              <span className="flex-1">{q}</span>
              <button
                type="button"
                onClick={() => setQuestions(questions.filter((x) => x !== q))}
                className="text-fuchsia-200/60 hover:text-fuchsia-100"
                aria-label={`Remove question ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          {questions.length < 5 && (
            <input
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addQuestion();
                }
              }}
              onBlur={addQuestion}
              placeholder="e.g. Опишите проект где вы работали с AutoCAD"
              className="w-full rounded-md border border-fuchsia-500/20 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-fuchsia-300/40"
            />
          )}
        </div>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "…" : "Create vacancy"}
        </button>
      </div>
    </form>
  );
}

function OwnerFileUpload({ projectId, onUploaded }: { projectId: string; onUploaded: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await buildApi.uploadFile({
        projectId,
        url: url.trim(),
        name: name.trim() || undefined,
      });
      setUrl("");
      setName("");
      onUploaded();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Attach file URL
      </h3>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        required
        className="mb-2 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Display name (optional)"
        className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}
      <button
        type="submit"
        disabled={busy || !url}
        className="w-full rounded-md bg-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/20 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Attach file"}
      </button>
      <p className="mt-2 text-xs text-slate-500">
        Files are stored externally. Paste a public URL (CDN, object store).
      </p>
    </form>
  );
}

function ProjectStatusButton({
  projectId,
  currentStatus,
  onUpdated,
}: {
  projectId: string;
  currentStatus: string;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const next =
    currentStatus === "OPEN" ? "IN_PROGRESS" :
    currentStatus === "IN_PROGRESS" ? "DONE" : null;

  if (!next) return null;

  const label =
    next === "IN_PROGRESS" ? "Mark In Progress" :
    next === "DONE" ? "Mark Complete ✓" : "";

  const cls =
    next === "DONE"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
      : "border-sky-500/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20";

  async function advance() {
    setBusy(true);
    try {
      await buildApi.updateProject(projectId, { status: next as "IN_PROGRESS" | "DONE" });
      onUpdated();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={advance}
      disabled={busy}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${cls}`}
    >
      {busy ? "…" : label}
    </button>
  );
}
