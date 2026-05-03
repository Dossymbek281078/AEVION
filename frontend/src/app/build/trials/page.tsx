"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildTrialTask, type TrialTaskStatus } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

type RichTrialTask = BuildTrialTask & { vacancyTitle?: string; projectTitle?: string };

const STATUS_COLOR: Record<TrialTaskStatus, string> = {
  PROPOSED: "text-amber-200 bg-amber-500/10 border-amber-500/20",
  ACCEPTED: "text-sky-200 bg-sky-500/10 border-sky-500/20",
  SUBMITTED: "text-fuchsia-200 bg-fuchsia-500/10 border-fuchsia-500/20",
  APPROVED: "text-emerald-200 bg-emerald-500/10 border-emerald-500/20",
  REJECTED: "text-rose-200 bg-rose-500/10 border-rose-500/20",
};

export default function TrialsPage() {
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
  const [items, setItems] = useState<RichTrialTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState("");
  const [submitNote, setSubmitNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await buildApi.myTrialTasks();
      setItems(r.items as RichTrialTask[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(id: string) {
    try {
      await buildApi.acceptTrialTask(id);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function submit(id: string) {
    try {
      await buildApi.submitTrialTask(id, {
        submissionUrl: submitUrl || undefined,
        submissionNote: submitNote || undefined,
      });
      setSubmitting(null);
      setSubmitUrl("");
      setSubmitNote("");
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function approve(id: string) {
    try {
      await buildApi.approveTrialTask(id);
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function reject(id: string) {
    const reason = prompt("Reason for rejection (optional):");
    try {
      await buildApi.rejectTrialTask(id, reason ?? "");
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const asCandidate = items.filter((t) => t.candidateId === me?.id);
  const asRecruiter = items.filter((t) => t.recruiterId === me?.id);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trial tasks</h1>
          <p className="mt-1 text-sm text-slate-400">
            Paid test assignments between candidates and employers.
          </p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-slate-400">
            No trial tasks yet. Employers can propose a trial task after reviewing your application.
          </p>
          <Link
            href="/build/vacancies"
            className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
          >
            Browse vacancies →
          </Link>
        </div>
      )}

      {asCandidate.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            As candidate ({asCandidate.length})
          </h2>
          <div className="space-y-3">
            {asCandidate.map((t) => (
              <TaskCard key={t.id} task={t} role="candidate"
                onAccept={() => accept(t.id)}
                onSubmitOpen={() => { setSubmitting(t.id); setSubmitUrl(""); setSubmitNote(""); }}
                submitting={submitting === t.id}
                submitUrl={submitUrl}
                setSubmitUrl={setSubmitUrl}
                submitNote={submitNote}
                setSubmitNote={setSubmitNote}
                onSubmitSend={() => submit(t.id)}
                onSubmitCancel={() => setSubmitting(null)}
              />
            ))}
          </div>
        </section>
      )}

      {asRecruiter.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">
            As recruiter ({asRecruiter.length})
          </h2>
          <div className="space-y-3">
            {asRecruiter.map((t) => (
              <TaskCard key={t.id} task={t} role="recruiter"
                onApprove={() => approve(t.id)}
                onReject={() => reject(t.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TaskCard({
  task,
  role,
  onAccept,
  onSubmitOpen,
  submitting,
  submitUrl,
  setSubmitUrl,
  submitNote,
  setSubmitNote,
  onSubmitSend,
  onSubmitCancel,
  onApprove,
  onReject,
}: {
  task: RichTrialTask;
  role: "candidate" | "recruiter";
  onAccept?: () => void;
  onSubmitOpen?: () => void;
  submitting?: boolean;
  submitUrl?: string;
  setSubmitUrl?: (v: string) => void;
  submitNote?: string;
  setSubmitNote?: (v: string) => void;
  onSubmitSend?: () => void;
  onSubmitCancel?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const statusCls = STATUS_COLOR[task.status] ?? "text-slate-200";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{task.title}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusCls}`}>
              {task.status}
            </span>
          </div>
          {(task.vacancyTitle || task.projectTitle) && (
            <div className="mt-0.5 text-xs text-slate-400">
              {task.vacancyTitle}{task.projectTitle ? ` · ${task.projectTitle}` : ""}
            </div>
          )}
          <p className="mt-2 text-sm text-slate-300">{task.description}</p>
          {task.rejectReason && (
            <p className="mt-1 text-xs text-rose-300">Reason: {task.rejectReason}</p>
          )}
          {task.submissionUrl && (
            <a
              href={task.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs text-emerald-300 hover:underline"
            >
              View submission →
            </a>
          )}
          {task.submissionNote && (
            <p className="mt-1 text-xs text-slate-400 italic">{task.submissionNote}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500">Payment</div>
          <div className="font-semibold text-emerald-300">
            {task.paymentAmount > 0
              ? `${task.paymentAmount.toLocaleString("ru-RU")} ${task.paymentCurrency}`
              : "—"}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {new Date(task.updatedAt).toLocaleDateString("ru-RU")}
          </div>
        </div>
      </div>

      {role === "candidate" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.status === "PROPOSED" && (
            <button
              onClick={onAccept}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
            >
              Accept task
            </button>
          )}
          {task.status === "ACCEPTED" && (
            <button
              onClick={onSubmitOpen}
              className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20"
            >
              Submit work
            </button>
          )}
        </div>
      )}

      {submitting && role === "candidate" && (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <input
            type="url"
            value={submitUrl}
            onChange={(e) => setSubmitUrl?.(e.target.value)}
            placeholder="Link to your work (GitHub, Figma, Drive…)"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <textarea
            value={submitNote}
            onChange={(e) => setSubmitNote?.(e.target.value)}
            rows={2}
            placeholder="Notes for the recruiter (optional)"
            className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onSubmitSend}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              Send submission
            </button>
            <button
              onClick={onSubmitCancel}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {role === "recruiter" && task.status === "SUBMITTED" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onApprove}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Approve & pay
          </button>
          <button
            onClick={onReject}
            className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            Reject
          </button>
        </div>
      )}
      {role === "recruiter" && task.status === "APPROVED" && task.paymentAmount > 0 && (
        <div className="mt-3">
          <a
            href={`/api/build/trial-tasks/${encodeURIComponent(task.id)}/invoice.pdf`}
            download
            className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            ⬇ Invoice PDF
          </a>
        </div>
      )}
    </div>
  );
}
