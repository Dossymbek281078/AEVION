"use client";

import { useMemo, useState } from "react";
import { LEVEL1_LSR } from "../lib/levels";
import { calcLsr } from "../lib/calc";
import { useProgress } from "../lib/useProgress";
import { Ks2View } from "./Ks2View";

const DOPRABOTY_LSR = {
  ...LEVEL1_LSR,
  id: "lsr-l3-dop",
  title: "Доп. ЛСР — Усиление основания перекрытий (4 класса)",
  sections: [
    {
      id: "dop-s1",
      title: "Допработы. Ремонт основания перекрытий",
      category: "общестроительные" as const,
      positions: [
        { id: "dop-p1", rateCode: "ДЕМ-11-02-001", volume: 0.80, coefficients: [], formula: "4 класса × 20 м² / 100" },
        { id: "dop-p2", rateCode: "ОТД-11-02-001", volume: 0.80, coefficients: [], formula: "4 × 20 / 100" },
      ],
    },
  ],
};

const JOURNAL = [
  { month: "Июнь 2026",     note: "Начало работ. Демонтаж в 2 классах на 1 этаже." },
  { month: "Июль 2026",     note: "Демонтаж завершён. Штукатурка 50% крыла." },
  { month: "Август 2026",   note: "При вскрытии полов повреждения в 4 классах. Деф. акт №3-2026. Оформляем допработы." },
  { month: "Сентябрь 2026", note: "Окраска, полы (1–2 эт.). Допработы выполнены." },
  { month: "Октябрь 2026",  note: "Полы (3–4 эт.), окна, двери." },
  { month: "Ноябрь 2026",   note: "Финальная окраска. t°=-5°C. Применить зимнее удорожание." },
];

type KsTab = "main" | "dop";

export function Level3View() {
  const { setLevel } = useProgress();
  const [ksTab, setKsTab] = useState<KsTab>("main");
  const mainCalc = useMemo(() => calcLsr(LEVEL1_LSR), []);
  const dopCalc = useMemo(() => calcLsr(DOPRABOTY_LSR), []);

  function handleZachet() {
    setLevel(3, { status: "done", completedAt: new Date().toISOString() });
    alert("Уровень 3 зачтён! КС-2 за 6 месяцев + допработы.");
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Левая панель — роль ПТО */}
      <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col overflow-auto">
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Уровень 3</div>
          <div className="text-sm font-bold mt-0.5">Инженер ПТО</div>
          <div className="text-xs text-slate-400 mt-1">Ведёте «Капремонт школы №47»</div>
        </div>

        <div className="px-4 py-3 border-b border-slate-700 flex-1 overflow-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Журнал производства работ</div>
          <div className="space-y-3">
            {JOURNAL.map((j, i) => (
              <div key={i} className="text-xs">
                <div className="font-semibold text-slate-200">{j.month}</div>
                <div className="text-slate-400 text-[11px] mt-0.5">{j.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-slate-400 bg-slate-800 rounded p-2.5">
            <div className="text-slate-300 font-semibold mb-1">Дефектный акт №3-2026</div>
            При вскрытии полов в классах 201–204 обнаружены трещины. Требуется усиление основания (4 кл × 20 м²). Допсоглашение подписано.
          </div>

          <div className="mt-3 text-[10px] text-amber-300 bg-amber-900/30 rounded p-2">
            ❄️ Ноябрь: наружная t°=-5°C. К позициям с красками, грунтами — зимний коэффициент по СН РК 8.02-09.
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-700 space-y-2">
          <div className="text-[10px] text-slate-400 uppercase font-bold">Задание</div>
          <ol className="text-xs text-slate-300 space-y-1 list-decimal list-inside">
            <li>6 периодов в КС-2 по журналу</li>
            <li>Допработы — отдельный КС-2</li>
            <li>Ноябрь — зимнее удорожание</li>
            <li>КС-3 нарастающим итогом</li>
          </ol>
          <button
            onClick={handleZachet}
            className="w-full py-2 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 mt-2"
          >
            Сдать на зачёт
          </button>
        </div>
      </aside>

      {/* Правая область */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="shrink-0 border-b border-slate-200 bg-white flex px-4">
          {([["main", "КС-2 Основной договор"], ["dop", "КС-2 Допработы (август)"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setKsTab(key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 ${ksTab === key ? "border-emerald-500 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-auto">
          <Ks2View calc={ksTab === "main" ? mainCalc : dopCalc} />
        </div>
      </div>
    </div>
  );
}
