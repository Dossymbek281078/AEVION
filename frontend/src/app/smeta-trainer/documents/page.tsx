"use client";

/**
 * Хаб учебных документов — все формы приёмки и исполнительной документации
 * в одном месте поверх LEVEL1_LSR (Школа №47, Алматы).
 *
 * Формы:
 *  - КС-2 «Акт о приёмке выполненных работ» (РФ-форма, аналог)
 *  - КС-3 «Справка о стоимости» (нарастающим итогом)
 *  - Ф-2 НДЦС РК 8.01-08 (национальная форма РК, 3 подписи)
 *  - АОСР «Акт освидетельствования скрытых работ» (СН РК 1.03-00)
 *
 * Все формы печатаются через window.print() (A4-вёрстка) — не требуется PDF-библиотека.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { LEVEL1_LSR } from "../lib/levels";
import { calcLsr } from "../lib/calc";
import { useKs2Periods } from "../lib/useKs2Periods";
import { Ks2View } from "../components/Ks2View";
import { Ks3View } from "../components/Ks3View";
import { Form2RkView } from "../components/Form2RkView";
import { HiddenWorksActView } from "../components/HiddenWorksActView";

type DocTab = "ks2" | "ks3" | "form2rk" | "aosr";

const TABS: Array<{ key: DocTab; label: string; sub: string; ref: string }> = [
  {
    key: "ks2",
    label: "КС-2",
    sub: "Акт о приёмке выполненных работ",
    ref: "Госкомстат РФ № 100 от 11.11.1999 (учебно)",
  },
  {
    key: "ks3",
    label: "КС-3",
    sub: "Справка о стоимости работ и затрат",
    ref: "Госкомстат РФ № 100 от 11.11.1999 (учебно)",
  },
  {
    key: "form2rk",
    label: "Ф-2 РК",
    sub: "Акт выполненных работ (РК)",
    ref: "НДЦС РК 8.01-08-2022 · Приказ МФ РК № 562",
  },
  {
    key: "aosr",
    label: "АОСР",
    sub: "Акт освидетельствования скрытых работ",
    ref: "СН РК 1.03-00 · Приказ МНЭ РК № 230",
  },
];

export default function DocumentsHubPage() {
  const [tab, setTab] = useState<DocTab>("ks2");
  const calc = useMemo(() => calcLsr(LEVEL1_LSR), []);
  const { periods } = useKs2Periods(LEVEL1_LSR.id);
  const active = TABS.find((t) => t.key === tab)!;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Хедер */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <Link href="/smeta-trainer" className="text-xs text-blue-600 hover:underline">
              ← Главная
            </Link>
            <h1 className="text-xl font-bold text-slate-900 mt-1">Учебные документы</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              4 формы на основе ЛСР «{LEVEL1_LSR.title}» — печать через браузер на А4.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Активная форма</div>
            <div className="text-sm font-bold text-emerald-700">{active.label}</div>
            <div className="text-[10px] text-slate-500">{active.ref}</div>
          </div>
        </div>
      </header>

      {/* Табы */}
      <div className="bg-white border-b border-slate-200 print:hidden">
        <div className="max-w-6xl mx-auto flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap ${
                tab === t.key
                  ? "border-emerald-500 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <div className="text-sm font-bold">{t.label}</div>
              <div className="text-[10px] font-normal opacity-70">{t.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Содержимое формы */}
      <main className="max-w-6xl mx-auto p-6 print:p-0 print:max-w-none">
        {tab === "ks2" && <Ks2View calc={calc} />}
        {tab === "ks3" && <Ks3View calc={calc} ks2Periods={periods} />}
        {tab === "form2rk" && <Form2RkView calc={calc} />}
        {tab === "aosr" && <HiddenWorksActView calc={calc} />}
      </main>

      {/* Подсказка студенту */}
      <div className="max-w-6xl mx-auto px-6 pb-6 print:hidden">
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-900">
          <strong>📚 На заметку:</strong> на госзаказах РК подрядчик сдаёт{" "}
          <em>обе</em> формы — КС-2 (для бухгалтерии и налоговых сверок) и Ф-2 РК (для технадзора
          заказчика). АОСР оформляется <em>до</em> закрытия работ актом — иначе технадзор не
          подпишет КС-2 / Ф-2.
        </div>
      </div>
    </div>
  );
}
