"use client";

import { useEffect, useState } from "react";
import { buildApi, type BuildTrialTask, type TrialTaskStatus } from "@/lib/build/api";

const TONE: Record<TrialTaskStatus, string> = {
  PROPOSED: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  ACCEPTED: "border-sky-500/40 bg-sky-500/10 text-sky-200",
  SUBMITTED: "border-purple-500/40 bg-purple-500/10 text-purple-200",
  APPROVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  REJECTED: "border-rose-500/40 bg-rose-500/10 text-rose-200",
};

export function TrialTaskBlock({
  applicationId,
  isRecruiter,
  isCandidate,
  onChanged,
}: {
  applicationId: string;
  isRecruiter: boolean;
  isCandidate: boolean;
  onChanged?: () => void;
}) {
  const [tasks, setTasks] = useState<BuildTrialTask[] | null>(null);
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    buildApi
      .trialTasksByApplication(applicationId)
      .then((r) => setTasks(r.items))
      .catch(() => setTasks([]));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  if (tasks === null) return null;

  const hasTasks = tasks.length > 0;

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          🧪 Paid trial task
        </div>
        {isRecruiter && !proposing && !hasTasks && (
          <button
            onClick={() => setProposing(true)}
            className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-200 hover:bg-emerald-500/25"
          >
            + Propose paid task
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}

      {proposing && isRecruiter && (
        <ProposeForm
          applicationId={applicationId}
          onCancel={() => setProposing(false)}
          onCreated={() => {
            setProposing(false);
            refresh();
            onChanged?.();
          }}
        />
      )}

      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          isRecruiter={isRecruiter}
          isCandidate={isCandidate}
          onChanged={() => {
            refresh();
            onChanged?.();
          }}
          onError={(e) => setError(e)}
        />
      ))}

      {!hasTasks && !proposing && !isRecruiter && (
        <p className="text-xs text-slate-500">
          Recruiter hasn&apos;t proposed a paid trial task on this application yet.
        </p>
      )}
    </div>
  );
}

function ProposeForm({
  applicationId,
  onCancel,
  onCreated,
}: {
  applicationId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          await buildApi.proposeTrialTask({
            applicationId,
            title: title.trim(),
            description: description.trim(),
            paymentAmount: amount ? Number(amount) : 0,
          });
          onCreated();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-2 text-sm"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title (e.g. Weld 2 sample joints, photo proof)"
        required
        minLength={3}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="What exactly does the candidate need to do? Include acceptance criteria."
        required
        minLength={10}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
      />
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          placeholder="Payment amount (₽, 0 = unpaid trial)"
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-500"
        />
        <span className="text-xs text-slate-500">RUB</span>
      </div>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-white/10 px-3 py-1 text-xs text-slate-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "…" : "Propose"}
        </button>
      </div>
    </form>
  );
}

function TaskRow({
  task,
  isRecruiter,
  isCandidate,
  onChanged,
  onError,
}: {
  task: BuildTrialTask;
  isRecruiter: boolean;
  isCandidate: boolean;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [subUrl, setSubUrl] = useState("");
  const [subNote, setSubNote] = useState("");

  const act = async (op: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await op();
      onChanged();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`rounded-lg border p-3 text-sm ${TONE[task.status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{task.title}</div>
          <p className="mt-0.5 whitespace-pre-wrap text-xs opacity-80">{task.description}</p>
          <div className="mt-1 text-xs opacity-70">
            {task.paymentAmount > 0
              ? `${task.paymentAmount.toLocaleString("ru-RU")} ${task.paymentCurrency}`
              : "Unpaid trial"}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-bold uppercase">
          {task.status}
        </span>
      </div>

      {task.status === "SUBMITTED" && (task.submissionUrl || task.submissionNote) && (
        <div className="mt-2 rounded border border-white/10 bg-black/20 p-2 text-xs">
          <div className="mb-1 font-bold opacity-70">Submission</div>
          {task.submissionUrl && (
            <a
              href={task.submissionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all text-emerald-300 hover:underline"
            >
              {task.submissionUrl}
            </a>
          )}
          {task.submissionNote && <p className="mt-1 whitespace-pre-wrap">{task.submissionNote}</p>}
        </div>
      )}

      {task.status === "REJECTED" && task.rejectReason && (
        <p className="mt-2 text-xs opacity-80">Reason: {task.rejectReason}</p>
      )}

      {/* Escrow badge */}
      {task.paymentAmount > 0 && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-[11px]">
          <span className="text-slate-400">Эскроу:</span>
          <span className={`font-bold ${
            task.status === "APPROVED" ? "text-emerald-300" :
            task.status === "REJECTED" ? "text-rose-300" : "text-amber-300"
          }`}>
            {task.status === "APPROVED" ? "✓ Освобождён" :
             task.status === "REJECTED" ? "↩ Возврат" : "🔒 Заморожен"}
          </span>
          <span className="ml-auto font-semibold text-slate-300">
            {task.paymentAmount.toLocaleString("ru-RU")} {task.paymentCurrency}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {isCandidate && task.status === "PROPOSED" && (
          <>
            <button
              disabled={busy}
              onClick={() => act(() => buildApi.acceptTrialTask(task.id))}
              className="rounded-md bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              disabled={busy}
              onClick={() => act(() => buildApi.rejectTrialTask(task.id, "Declined by candidate"))}
              className="rounded-md bg-rose-500/30 px-3 py-1 text-xs font-semibold hover:bg-rose-500/50 disabled:opacity-50"
            >
              Decline
            </button>
          </>
        )}

        {isCandidate && task.status === "ACCEPTED" && !submitOpen && (
          <button
            onClick={() => setSubmitOpen(true)}
            className="rounded-md bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50"
          >
            Submit work
          </button>
        )}

        {isRecruiter && task.status === "SUBMITTED" && (
          <>
            <button
              disabled={busy}
              onClick={() => act(() => buildApi.approveTrialTask(task.id))}
              className="rounded-md bg-emerald-500/30 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/50 disabled:opacity-50"
            >
              Approve + create payout
            </button>
            <button
              disabled={busy}
              onClick={() => {
                const reason = prompt("Why are you rejecting this submission?") || "";
                if (reason) act(() => buildApi.rejectTrialTask(task.id, reason));
              }}
              className="rounded-md bg-rose-500/30 px-3 py-1 text-xs font-semibold hover:bg-rose-500/50 disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>

      {submitOpen && isCandidate && task.status === "ACCEPTED" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await act(() =>
              buildApi.submitTrialTask(task.id, {
                submissionUrl: subUrl.trim() || null,
                submissionNote: subNote.trim() || null,
              }),
            );
            setSubmitOpen(false);
            setSubUrl("");
            setSubNote("");
          }}
          className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 p-2 text-xs"
        >
          <input
            value={subUrl}
            onChange={(e) => setSubUrl(e.target.value)}
            placeholder="Photo / video URL (optional)"
            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-white placeholder:text-slate-500"
          />
          <textarea
            value={subNote}
            onChange={(e) => setSubNote(e.target.value)}
            rows={2}
            placeholder="Notes about your submission"
            className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-white placeholder:text-slate-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSubmitOpen(false)}
              className="rounded border border-white/10 px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-emerald-500 px-2 py-1 font-semibold text-emerald-950 disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
