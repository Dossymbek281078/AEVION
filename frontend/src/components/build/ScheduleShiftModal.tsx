"use client";

import { useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";

// Only the client who owns the vacancy can schedule, and only against an
// ACCEPTED application — the backend enforces both, so these are the errors
// worth naming rather than showing a raw code.
const ERROR_TEXT: Record<string, string> = {
  accepted_application_not_found: "Отклик не найден или ещё не принят.",
  only_client_can_schedule: "Планировать смену может только заказчик этой вакансии.",
};

export function ScheduleShiftModal({
  applicationId,
  workerName,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  workerName?: string | null;
  onClose: () => void;
  onScheduled?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [shiftDate, setShiftDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Overnight shifts are normal on site, so end < start is not an error —
  // only a missing date is.
  const canSubmit = shiftDate.length === 10 && !busy;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await buildApi.createShift({
        applicationId,
        shiftDate,
        startTime: startTime || null,
        endTime: endTime || null,
        notes: notes.trim() || null,
      });
      onScheduled?.();
      onClose();
    } catch (e) {
      const code = e instanceof BuildApiError ? e.code : (e as Error).message;
      setErr(ERROR_TEXT[code] ?? code);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-emerald-500/10 px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-emerald-200">📅 Смена</div>
            <h3 className="text-base font-bold text-white">
              {workerName ? `Назначить смену: ${workerName}` : "Назначить смену"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 px-2 py-1 text-xs text-slate-300 hover:bg-white/5"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="text-xs font-medium text-slate-300">Дата</span>
            <input
              type="date"
              value={shiftDate}
              min={today}
              onChange={(e) => setShiftDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Начало</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Конец</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-300">Что делать на объекте</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Адрес, участок, что взять с собой"
              className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400/50"
            />
            <span className="mt-1 block text-right text-[11px] text-slate-500">{notes.length}/500</span>
          </label>

          <p className="text-xs text-slate-400">
            Работник получит уведомление и сможет отметить приход и уход на странице смен.
          </p>

          {err && <p className="text-sm text-rose-300">{err}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-white/10 bg-white/[0.02] px-5 py-3 text-xs">
          <button
            onClick={onClose}
            className="rounded-md border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="rounded-md bg-emerald-500 px-3 py-1.5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? "Назначаю…" : "Назначить смену"}
          </button>
        </div>
      </div>
    </div>
  );
}
