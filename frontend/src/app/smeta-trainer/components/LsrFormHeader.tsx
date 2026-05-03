"use client";

import type { LsrMeta, LsrCalc } from "../lib/types";
import { formatKzt } from "../lib/calc";

interface Props {
  meta: LsrMeta;
  calc: LsrCalc;
  onChange: (meta: LsrMeta) => void;
}

function Field({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}) {
  return (
    <div className={`flex gap-1 items-baseline ${wide ? "col-span-2" : ""}`}>
      <span className="text-[10px] text-slate-500 shrink-0 whitespace-nowrap">{label}:</span>
      <input
        className="border-b border-slate-300 focus:border-emerald-500 outline-none text-xs text-slate-800 bg-transparent flex-1 min-w-0 px-0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}

export function LsrFormHeader({ meta, calc, onChange }: Props) {
  const totalDirect = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const totalFot = calc.sections.reduce((s, sc) => s + sc.fot, 0);
  const totalLabourHours = calc.sections.reduce(
    (s, sc) =>
      s +
      sc.positions.reduce((ps, p) => {
        const labourRes = p.rate.resources.filter((r) => r.kind === "труд");
        return ps + labourRes.reduce((ls, r) => ls + r.qtyPerUnit * p.position.volume, 0);
      }, 0),
    0
  );

  function set<K extends keyof LsrMeta>(key: K) {
    return (v: string) => onChange({ ...meta, [key]: v });
  }

  return (
    <div className="bg-white border border-slate-300 text-xs print:border-black">
      {/* Нормативная ссылка */}
      <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50">
        <span className="text-slate-400">НДЦС РК 8.01-08-2022. Приложение Г.</span>
        <span className="font-semibold text-slate-600">Форма 4*</span>
      </div>

      {/* Строки шапки */}
      <div className="px-3 pt-2 pb-1 grid grid-cols-2 gap-x-8 gap-y-1.5">
        <Field label="Наименование стройки" value={meta.strojkaTitle ?? ""} onChange={set("strojkaTitle")} wide />
        <Field label="Шифр стройки" value={meta.strojkaCode ?? ""} onChange={set("strojkaCode")} />
        <Field label="Наименование объекта" value={meta.objectTitle ?? ""} onChange={set("objectTitle")} wide />
        <Field label="Шифр объекта" value={meta.objectCode ?? ""} onChange={set("objectCode")} />
      </div>

      {/* Номер ЛСР */}
      <div className="px-3 py-1 border-t border-slate-100 flex items-baseline gap-2">
        <span className="font-semibold text-slate-700 text-sm">ЛОКАЛЬНАЯ СМЕТА №</span>
        <input
          className="border-b border-slate-400 focus:border-emerald-500 outline-none font-semibold text-slate-800 bg-transparent w-32 text-sm px-0.5"
          value={meta.lsrNumber ?? ""}
          onChange={(e) => onChange({ ...meta, lsrNumber: e.target.value })}
          placeholder="—"
        />
        <span className="text-slate-400 text-[10px]">(Локальный сметный расчёт)</span>
      </div>

      <div className="px-3 py-1 flex gap-1 items-baseline border-t border-slate-100">
        <span className="text-slate-500 text-[10px] shrink-0">на</span>
        <input
          className="border-b border-slate-300 focus:border-emerald-500 outline-none text-xs text-slate-800 bg-transparent flex-1 px-0.5"
          value={meta.worksTitle ?? ""}
          onChange={(e) => onChange({ ...meta, worksTitle: e.target.value })}
          placeholder="Наименование работ и затрат"
        />
      </div>

      <div className="px-3 py-1 flex gap-1 items-baseline border-t border-slate-100">
        <span className="text-slate-500 text-[10px] shrink-0">Основание:</span>
        <input
          className="border-b border-slate-300 focus:border-emerald-500 outline-none text-xs text-slate-800 bg-transparent flex-1 px-0.5"
          value={meta.osnovanje ?? ""}
          onChange={(e) => onChange({ ...meta, osnovanje: e.target.value })}
          placeholder="РП, том, альбом"
        />
      </div>

      {/* Сводные показатели */}
      <div className="px-3 pt-2 pb-1 border-t border-slate-200 grid grid-cols-2 gap-x-8 gap-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600">Сметная стоимость</span>
          <span className="font-semibold text-slate-800 font-mono">
            {(totalDirect / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} тыс.тнг.
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Средства на оплату труда</span>
          <span className="font-semibold font-mono">
            {(totalFot / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} тыс.тнг.
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Нормативная трудоёмкость</span>
          <span className="font-semibold font-mono">
            {(totalLabourHours / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} тыс.чел-ч
          </span>
        </div>
      </div>

      {/* Дата и составил */}
      <div className="px-3 py-1.5 border-t border-slate-200 flex justify-between items-center">
        <div className="flex gap-1 items-baseline">
          <span className="text-slate-500 text-[10px]">Составлен(а) в текущих ценах</span>
          <input
            className="border-b border-slate-300 focus:border-emerald-500 outline-none text-[11px] bg-transparent w-36 px-0.5"
            value={meta.priceDate ?? ""}
            onChange={(e) => onChange({ ...meta, priceDate: e.target.value })}
            placeholder="декабрь 2025 г."
          />
        </div>
        <div className="flex gap-1 items-baseline">
          <span className="text-slate-500 text-[10px]">Составил:</span>
          <input
            className="border-b border-slate-300 focus:border-emerald-500 outline-none text-[11px] bg-transparent w-40 px-0.5"
            value={meta.author ?? ""}
            onChange={(e) => onChange({ ...meta, author: e.target.value })}
            placeholder="ФИО студента"
          />
        </div>
      </div>
    </div>
  );
}
