"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type LaborRate = {
  regionCode: string;
  groupCode: string;
  rank: number;
  sczt: number;
  sts: number;
};
type LaborRegion = { code: string; name: string };
type LaborGroup = { code: string; name: string };
type LaborFile = {
  version: string;
  title: string;
  approvedBy: string;
  effectiveFrom: string;
  priceLevel: string;
  regions: LaborRegion[];
  groups: LaborGroup[];
  rates: LaborRate[];
};

type MachineRow = {
  code: string;
  name: string;
  isGroup?: boolean;
  smetnaya?: number;
  directCosts?: number;
  operatorWage?: number;
  relocation?: number;
};
type MachineFile = {
  version: string;
  title: string;
  region: string;
  approvedBy: string;
  effectiveFrom: string;
  unit: string;
  rows: MachineRow[];
};

type Tab = "labor" | "machines";

function formatTenge(n?: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU") + " ₸";
}

export default function LaborMachinesPage() {
  const [tab, setTab] = useState<Tab>("labor");
  const [labor, setLabor] = useState<LaborFile | null>(null);
  const [machines, setMachines] = useState<MachineFile | null>(null);
  const [region, setRegion] = useState("02"); // Алматы
  const [group, setGroup] = useState("003"); // Отделочные
  const [machineQuery, setMachineQuery] = useState("");

  useEffect(() => {
    fetch("/normatives/sczt-2025.json").then((r) => r.json()).then(setLabor).catch(() => {});
    fetch("/normatives/szem-2025-almaty.json").then((r) => r.json()).then(setMachines).catch(() => {});
  }, []);

  const ranksForGroup = useMemo(() => {
    if (!labor) return [] as LaborRate[];
    return labor.rates
      .filter((r) => r.regionCode === region && r.groupCode === group)
      .sort((a, b) => a.rank - b.rank);
  }, [labor, region, group]);

  const filteredMachines = useMemo(() => {
    if (!machines) return [] as MachineRow[];
    const q = machineQuery.trim().toLowerCase();
    if (!q) return machines.rows.filter((r) => !r.isGroup).slice(0, 200);
    const isCode = /^\d/.test(q);
    return machines.rows.filter((r) => {
      if (r.isGroup) return false;
      if (isCode) return r.code.includes(q);
      return r.name.toLowerCase().includes(q);
    }).slice(0, 200);
  }, [machines, machineQuery]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link href="/smeta-trainer" className="text-xs text-slate-500 hover:text-slate-900">
            ← К курсу
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-900">
              Труд и машины · нормативные ставки РК-2025
            </h1>
            <p className="text-[11px] text-slate-500">
              СЦЗТ + СЦЭМ от Комитета по делам строительства МПС РК
            </p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setTab("labor")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                tab === "labor" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              💼 Труд (СЦЗТ)
            </button>
            <button
              onClick={() => setTab("machines")}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                tab === "machines" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              🚜 Машины (СЦЭМ)
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4">
        {tab === "labor" && (
          <div className="space-y-3">
            {!labor && <div className="p-6 text-slate-400 text-sm">Загрузка СЦЗТ…</div>}
            {labor && (
              <>
                <div className="bg-white border rounded-lg p-4 flex flex-wrap items-end gap-4">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-0.5">
                      Регион
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-64"
                    >
                      {labor.regions.map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.code} — {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase block mb-0.5">
                      Группа работ
                    </label>
                    <select
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      className="border rounded px-2 py-1 text-sm w-96"
                    >
                      {labor.groups.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.code} — {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 text-right text-[11px] text-slate-500">
                    Уровень цен: {labor.priceLevel}
                  </div>
                </div>

                <div className="bg-white border rounded-lg overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-600 uppercase text-[10px]">
                        <th className="px-3 py-2 w-24">Разряд</th>
                        <th className="px-3 py-2 w-32 text-right">СЦЗТ</th>
                        <th className="px-3 py-2 w-32 text-right">в т.ч. СТС</th>
                        <th className="px-3 py-2 text-slate-500">единица</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranksForGroup.map((r, i) => (
                        <tr key={i} className="border-t hover:bg-emerald-50/40">
                          <td className="px-3 py-1.5 font-mono">{r.rank.toFixed(1)}</td>
                          <td className="px-3 py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                            {formatTenge(r.sczt)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums">
                            {formatTenge(r.sts)}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">тенге/чел.-ч</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <div className="font-semibold mb-1">СЦЗТ vs СТС</div>
                  <strong>СЦЗТ</strong> (сметная цена на затраты труда) включает оплату труда +
                  все накладные на работника (соц.отчисления, отпуска, спецодежда). В смете
                  применяется СЦЗТ.<br />
                  <strong>СТС</strong> (сметная тарифная ставка) — только тарифная зарплата
                  рабочего; используется при расчёте надбавок (приаралье, СИЯП и т.п.).
                </div>
              </>
            )}
          </div>
        )}

        {tab === "machines" && (
          <div className="space-y-3">
            {!machines && (
              <div className="p-6 text-slate-400 text-sm">Загрузка СЦЭМ…</div>
            )}
            {machines && (
              <>
                <div className="bg-white border rounded-lg p-3 flex items-center gap-3">
                  <input
                    type="search"
                    value={machineQuery}
                    onChange={(e) => setMachineQuery(e.target.value)}
                    placeholder="Поиск по коду или названию (бульдозер, кран, экскаватор...)"
                    className="flex-1 border rounded px-3 py-1.5 text-sm"
                  />
                  <div className="text-[11px] text-slate-500 whitespace-nowrap">
                    {filteredMachines.length} из{" "}
                    {machines.rows.filter((r) => !r.isGroup).length}
                  </div>
                </div>

                <div className="bg-white border rounded-lg overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-left text-slate-600 uppercase text-[10px]">
                        <th className="px-2 py-2 w-32">Код</th>
                        <th className="px-2 py-2">Наименование</th>
                        <th className="px-2 py-2 w-28 text-right">Сметная</th>
                        <th className="px-2 py-2 w-28 text-right">Прямые</th>
                        <th className="px-2 py-2 w-28 text-right">ОТ маш.</th>
                        <th className="px-2 py-2 w-24 text-right">Перебаз.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMachines.map((r) => (
                        <tr key={r.code} className="border-t hover:bg-emerald-50/40">
                          <td className="px-2 py-1.5 font-mono text-slate-700">{r.code}</td>
                          <td className="px-2 py-1.5 text-slate-900">{r.name}</td>
                          <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                            {formatTenge(r.smetnaya)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">
                            {formatTenge(r.directCosts)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-600 tabular-nums">
                            {formatTenge(r.operatorWage)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-slate-500 tabular-nums">
                            {formatTenge(r.relocation)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-slate-400 px-2">
                  Все цены в тенге за 1 маш.-ч для региона «{machines.region}». Источник:{" "}
                  {machines.version} ({machines.approvedBy}).
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
