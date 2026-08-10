"use client";

import { useState } from "react";
import { buildApi, BuildApiError } from "@/lib/build/api";

const CURRENCIES = ["RUB", "KZT", "USD"] as const;

// Same ownership rules as scheduling a shift: the vacancy's client, against an
// application that is already ACCEPTED.
const ERROR_TEXT: Record<string, string> = {
  accepted_application_not_found: "Отклик не найден или ещё не принят.",
  only_client_can_schedule: "Планировать оплату может только заказчик этой вакансии.",
};

export function SchedulePaymentModal({
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
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("RUB");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const parsedAmount = Number(amount.replace(/\s/g, "").replace(",", "."));
  const amountValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await buildApi.createPaymentEvent({
        applicationId,
        amount: parsedAmount,
        currency,
        dueDate,
        note: note.trim() || null,
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
        <div className="flex items-center justify-between border-b border-white/10 bg-amber-500/10 px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-amber-200">💸 Оплата</div>
            <h3 className="text-base font-bold text-white">
              {workerName ? `Запланировать оплату: ${workerName}` : "Запланировать оплату"}
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
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Сумма</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="150000"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400/50"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-300">Валюта</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as (typeof CURRENCIES)[number])}
                className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-300">Срок оплаты</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-300">За что платёж</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="Аванс, этап работ, окончательный расчёт"
              className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400/50"
            />
            <span className="mt-1 block text-right text-[11px] text-slate-500">{note.length}/500</span>
          </label>

          <p className="text-xs text-slate-400">
            Платёж появится в календаре у обеих сторон. Это план, а не перевод денег.
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
            disabled={!amountValid || dueDate.length !== 10 || busy}
            onClick={() => void submit()}
            className="rounded-md bg-amber-500 px-3 py-1.5 font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Сохраняю…" : "Запланировать"}
          </button>
        </div>
      </div>
    </div>
  );
}
