"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildApi, type BuildPaymentEvent, type PaymentEventStatus } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";
import { HelpTip } from "@/components/build/HelpTip";

export default function PaymentCalendarPage() {
  const [items, setItems] = useState<BuildPaymentEvent[] | null>(null);
  const [summary, setSummary] = useState<{ due: number; paid: number; overdue: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const me = useBuildAuth((s) => s.user);

  const refresh = () =>
    buildApi
      .myPaymentCalendar()
      .then((r) => {
        setItems(r.items);
        setSummary(r.summary);
      })
      .catch((e) => setErr((e as Error).message));

  useEffect(() => { refresh(); }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    const map = new Map<string, BuildPaymentEvent[]>();
    for (const it of items) {
      const month = (it.dueDate || "").slice(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(it);
    }
    return Array.from(map.entries()).sort();
  }, [items]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">💸 Платёжный календарь</h1>
          <HelpTip>
            <p className="mb-1 font-semibold text-white">Как это работает?</p>
            <p>Работодатель добавляет ожидаемые выплаты — когда и сколько. Работник видит тот же календарь и подтверждает получение кнопкой «Оплачено».</p>
            <p className="mt-1.5">Статусы: <br/>
              🟡 PENDING — ждёт оплаты <br/>
              🔴 OVERDUE — просрочено <br/>
              ✅ PAID — подтверждено
            </p>
          </HelpTip>
        </div>
        <p className="text-sm text-slate-400">Когда и сколько вам платят (или вы платите) — без сюрпризов.</p>
      </div>

      {summary && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard label="К оплате" amount={summary.due} tone="amber" />
          <SummaryCard label="Просрочено" amount={summary.overdue} tone="rose" />
          <SummaryCard label="Оплачено" amount={summary.paid} tone="emerald" />
        </div>
      )}

      {err && <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}

      {items === null && <p className="text-sm text-slate-500">Загружаю…</p>}
      {items && items.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-500">
          Платежей пока нет. Когда клиент создаст график — он появится здесь.
        </p>
      )}

      <div className="space-y-6">
        {groups.map(([month, rows]) => (
          <section key={month}>
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              {monthLabel(month)}
            </div>
            <div className="space-y-2">
              {rows.map((row) => (
                <PaymentRow key={row.id} row={row} myId={me?.id ?? null} onChanged={refresh} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function SummaryCard({ label, amount, tone }: { label: string; amount: number; tone: "amber" | "emerald" | "rose" }) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "rose"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs uppercase opacity-70">{label}</div>
      <div className="mt-1 text-xl font-bold">{amount.toLocaleString("ru-RU")} ₽</div>
    </div>
  );
}

function PaymentRow({ row, myId, onChanged }: { row: BuildPaymentEvent; myId: string | null; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const due = row.status === "PENDING" && row.dueDate < new Date().toISOString().slice(0, 10);
  const tone =
    row.status === "PAID"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : due || row.status === "OVERDUE"
      ? "border-rose-500/30 bg-rose-500/5"
      : "border-white/10 bg-white/[0.03]";

  const update = async (patch: { status?: PaymentEventStatus }) => {
    setBusy(true);
    try { await buildApi.updatePaymentEvent(row.id, patch); onChanged(); }
    catch {/**/}
    finally { setBusy(false); }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${tone}`}>
      <div className="min-w-[8rem]">
        <div className="text-xs text-slate-400">{row.dueDate}</div>
        <div className="font-semibold text-white">{row.amount.toLocaleString("ru-RU")} {row.currency}</div>
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/build/applications/${row.applicationId}`} className="text-xs text-slate-300 hover:underline">
          App #{row.applicationId.slice(0, 8)}
        </Link>
        {row.note && <p className="mt-0.5 text-xs text-slate-400">{row.note}</p>}
      </div>
      <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
        {row.status}
      </span>
      {row.status === "PENDING" && (
        <div className="flex gap-1.5">
          <button
            disabled={busy}
            onClick={() => update({ status: "PAID" })}
            className="rounded-md bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            Оплачено
          </button>
          {row.clientId === myId && (
            <button
              disabled={busy}
              onClick={() => update({ status: "CANCELED" })}
              className="rounded-md bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
            >
              Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function monthLabel(ym: string): string {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  const months = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
  return `${months[(m || 1) - 1]} ${y}`;
}
