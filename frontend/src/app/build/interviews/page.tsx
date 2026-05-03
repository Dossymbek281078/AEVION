"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuildShell, RequireAuth } from "@/components/build/BuildShell";
import { buildApi, type BuildInterview } from "@/lib/build/api";
import { useBuildAuth } from "@/lib/build/auth";

export default function InterviewsPage() {
  return (
    <BuildShell>
      <RequireAuth>
        <InterviewsBody />
      </RequireAuth>
    </BuildShell>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PROPOSED: "⏳ Ожидает выбора",
  CONFIRMED: "✅ Подтверждено",
  CANCELED: "✕ Отменено",
};

const STATUS_TONE: Record<string, string> = {
  PROPOSED: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  CONFIRMED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  CANCELED: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function InterviewsBody() {
  const me = useBuildAuth((s) => s.user);
  const [items, setItems] = useState<BuildInterview[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    buildApi.myInterviews()
      .then((r) => setItems(r.items))
      .catch((e) => setErr((e as Error).message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">📆 Мои интервью</h1>
        <p className="mt-1 text-sm text-slate-400">
          Предложенные и подтверждённые встречи с кандидатами и работодателями.
        </p>
      </div>

      {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}
      {items === null && <p className="text-sm text-slate-500">Загружаю…</p>}
      {items && items.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-3xl">📅</p>
          <p className="mt-2 font-semibold text-slate-300">Интервью пока нет</p>
          <p className="mt-1 text-xs text-slate-500">
            Работодатель может предложить время встречи прямо из карточки отклика.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((iv) => (
          <div key={iv.id} className={`rounded-xl border p-4 ${STATUS_TONE[iv.status] ?? STATUS_TONE.PROPOSED}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                {iv.vacancyTitle && (
                  <div className="text-sm font-semibold text-white">{iv.vacancyTitle}</div>
                )}
                <div className="text-xs text-slate-400">
                  {iv.status === "CONFIRMED" && iv.confirmedSlot
                    ? `Встреча: ${fmt(iv.confirmedSlot)}`
                    : `Предложено ${iv.slots.length} вариант(а)`}
                </div>
              </div>
              <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                {STATUS_LABEL[iv.status] ?? iv.status}
              </span>
            </div>

            {iv.status === "PROPOSED" && iv.candidateId === me?.id && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-slate-400">Выберите удобное время:</p>
                <div className="flex flex-wrap gap-2">
                  {iv.slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={async () => {
                        try {
                          await buildApi.confirmInterview(iv.id, slot);
                          setItems((prev) => prev?.map((i) =>
                            i.id === iv.id ? { ...i, status: "CONFIRMED", confirmedSlot: slot } : i
                          ) ?? prev);
                        } catch (e) { setErr((e as Error).message); }
                      }}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25"
                    >
                      {fmt(slot)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {iv.status === "CONFIRMED" && iv.meetingUrl && (
              <a
                href={iv.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-400"
              >
                🔗 Открыть встречу
              </a>
            )}

            {iv.notes && (
              <p className="mt-2 text-xs text-slate-400">{iv.notes}</p>
            )}

            {iv.status !== "CANCELED" && (
              <button
                onClick={async () => {
                  try {
                    await buildApi.cancelInterview(iv.id);
                    setItems((prev) => prev?.map((i) =>
                      i.id === iv.id ? { ...i, status: "CANCELED" } : i
                    ) ?? prev);
                  } catch (e) { setErr((e as Error).message); }
                }}
                className="mt-2 text-xs text-slate-500 hover:text-rose-300"
              >
                Отменить
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
