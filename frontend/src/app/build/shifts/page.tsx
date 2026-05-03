"use client";

import { useEffect, useState } from "react";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi } from "@/lib/build/api";
import { SafetyBriefingModal } from "@/components/build/SafetyBriefingModal";
import { HelpTip } from "@/components/build/HelpTip";

type Shift = {
  id: string;
  applicationId: string;
  workerId: string;
  clientId: string;
  shiftDate: string;
  startTime: string | null;
  endTime: string | null;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workerName: string | null;
  clientName: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  PLANNED: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  STARTED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  DONE: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  MISSED: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Запланирована",
  STARTED: "В процессе",
  DONE: "Выполнена",
  MISSED: "Пропущена",
};

function fmt(t: string | null) {
  if (!t) return "—";
  return new Date(t).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

export default function ShiftsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <ShiftsInner />
      </RequireAuth>
    </BuildShell>
  );
}

function ShiftsInner() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [briefingShift, setBriefingShift] = useState<string | null>(null);

  function load() {
    buildApi.myShifts().then((r) => setShifts(r.items)).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function checkin(id: string) {
    setBusy(id);
    try {
      // Try to get GPS location for check-in
      let lat: number | undefined;
      let lng: number | undefined;
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }),
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {/*optional*/}
      }
      await buildApi.shiftCheckin(id, lat, lng);
      load();
    } catch {/**/} finally { setBusy(null); }
  }

  async function checkout(id: string) {
    setBusy(id);
    try { await buildApi.shiftCheckout(id); load(); } catch {/**/} finally { setBusy(null); }
  }

  // Group by date
  const byDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    const d = s.shiftDate;
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">📅 Смены</h1>
          <HelpTip>
            <p className="mb-1 font-semibold text-white">Как работают смены?</p>
            <p>Работодатель добавляет смены после принятия вашего отклика.</p>
            <p className="mt-1.5">Перед началом смены:</p>
            <p>1. Нажмите ⛑️ <strong>ТБ</strong> — прочитайте и подпишите инструктаж по безопасности</p>
            <p>2. Нажмите <strong>✓ Пришёл</strong> — GPS фиксирует время и место</p>
            <p>3. По окончании — <strong>⏹ Ушёл</strong></p>
          </HelpTip>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Расписание, отметка прихода и ухода на объекте
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/5" />)}
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-4xl">📅</p>
          <p className="mt-3 text-base font-semibold text-slate-200">Смен пока нет</p>
          <p className="mt-1 text-sm text-slate-400">Смены добавляет работодатель после того, как принял ваш отклик.</p>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p>1. Откликнитесь на вакансию → работодатель принимает отклик</p>
            <p>2. Работодатель создаёт смены в системе</p>
            <p>3. Вы подписываете инструктаж ТБ (⛑️) и нажимаете «✓ Пришёл»</p>
          </div>
          <a href="/build/vacancies" className="mt-4 inline-block rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/30">
            Найти вакансию →
          </a>
        </div>
      ) : null}

      {briefingShift && (
        <SafetyBriefingModal
          shiftId={briefingShift}
          onClose={() => setBriefingShift(null)}
          onSigned={() => load()}
        />
      )}

      {!loading && shifts.length > 0 && (
        <div className="space-y-6">
          {Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayShifts]) => (
              <div key={date}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-300">
                    {date === today ? "🟢 Сегодня" : new Date(date + "T12:00").toLocaleDateString("ru", { weekday: "long", day: "numeric", month: "long" })}
                  </h2>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-3">
                  {dayShifts.map((s) => (
                    <div key={s.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[s.status] ?? STATUS_STYLE.PLANNED}`}>
                            {STATUS_LABEL[s.status] ?? s.status}
                          </span>
                          {s.startTime && <span className="text-xs text-slate-400">{s.startTime}–{s.endTime ?? "?"}</span>}
                        </div>
                        <p className="mt-1 text-sm text-white">
                          {s.workerName ?? "Работник"} → {s.clientName ?? "Работодатель"}
                        </p>
                        {(s.checkInAt || s.checkOutAt) && (
                          <p className="text-xs text-slate-500">
                            Приход: {fmt(s.checkInAt)} / Уход: {fmt(s.checkOutAt)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {s.status === "PLANNED" && !s.checkInAt && (
                          <>
                            <button
                              onClick={() => setBriefingShift(s.id)}
                              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                            >
                              ⛑️ ТБ
                            </button>
                            <button
                              disabled={busy === s.id}
                              onClick={() => void checkin(s.id)}
                              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
                            >
                              {busy === s.id ? "…" : "✓ Пришёл"}
                            </button>
                          </>
                        )}
                        {s.checkInAt && !s.checkOutAt && (
                          <button
                            disabled={busy === s.id}
                            onClick={() => void checkout(s.id)}
                            className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
                          >
                            {busy === s.id ? "…" : "⏹ Ушёл"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
