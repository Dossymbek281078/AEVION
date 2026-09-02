"use client";

/**
 * «Своя смета из реальных позиций» — капстоун-режим поверх эталонного слоя.
 *
 * Студент выбирает реальные позиции из настоящих ЛС (Форма 4) в корзину, задаёт
 * объёмы и видит живые итоги ресурсным методом: всего + разбивка по видам
 * (труд / машины / материалы / перевозки). Корзина хранится локально.
 *
 * Разбивка по видам считается из ресурсов позиции: kindTotal(поз) / qty(поз) — это
 * стоимость вида на единицу; × выбранный объём = вклад вида в смету.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import realRates from "../../data/real-rates.json";
import { formatKzt } from "../../lib/calc";
import {
  KINDS,
  type Kind,
  type PositionLite,
  type SmetaLite,
  type BasketItem,
  type DiffStatus,
  kindPerUnitOf,
  basketTotals,
  realFactTotals,
  matchPercent,
  reconcilePositions,
  buildReconChecklist,
} from "../../lib/realBuild";

const STORAGE_KEY = "smeta-trainer:real-build:v1";

interface RealRates { smety: SmetaLite[] }
const DATA = realRates as unknown as RealRates;

const KIND_BADGE: Record<Kind, string> = {
  "труд": "bg-amber-100 text-amber-800",
  "машины": "bg-purple-100 text-purple-800",
  "материал": "bg-emerald-100 text-emerald-800",
  "перевозка": "bg-sky-100 text-sky-800",
};

// Цвет/иконка/подпись по статусу позиционной сверки (зелёный/жёлтый/красный — UX-принцип).
const DIFF_META: Record<DiffStatus, { icon: string; label: string; row: string; chip: string }> = {
  ok:      { icon: "✓", label: "Сошлось",          row: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-800" },
  qty:     { icon: "≠", label: "Неверный объём",   row: "bg-amber-50",   chip: "bg-amber-100 text-amber-800" },
  price:   { icon: "₸", label: "Неверная расценка", row: "bg-red-50",     chip: "bg-red-100 text-red-700" },
  missing: { icon: "–", label: "Пропущена",         row: "bg-red-50",     chip: "bg-red-100 text-red-700" },
  extra:   { icon: "+", label: "Лишняя",            row: "bg-amber-50",   chip: "bg-amber-100 text-amber-800" },
};
const DIFF_ORDER: DiffStatus[] = ["ok", "qty", "price", "missing", "extra"];

export default function RealBuildPage() {
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BasketItem[];
        if (Array.isArray(parsed)) setBasket(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(basket)); } catch {}
  }, [basket, hydrated]);

  const smeta = DATA.smety[active];
  const positions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return smeta.positions;
    return smeta.positions.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [smeta, query]);

  function addPosition(p: PositionLite) {
    setBasket((prev) => [
      ...prev,
      {
        uid: `bi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sheet: smeta.sheet,
        n: p.n,
        code: p.code,
        name: p.name,
        unit: p.unit,
        unitPrice: p.unitPrice,
        qty: p.qty,
        kindPerUnit: kindPerUnitOf(p),
      },
    ]);
  }
  function setQty(uid: string, qty: number) {
    setBasket((prev) => prev.map((b) => (b.uid === uid ? { ...b, qty } : b)));
  }
  function remove(uid: string) {
    setBasket((prev) => prev.filter((b) => b.uid !== uid));
  }
  function clearAll() {
    if (basket.length && !confirm("Очистить всю смету?")) return;
    setBasket([]);
  }

  const totals = useMemo(() => basketTotals(basket), [basket]);

  // Сравнение с эталонной ЛС (по умолчанию — активная в каталоге справа)
  const fact = useMemo(() => realFactTotals(smeta), [smeta]);
  // Позиционный разбор расхождений: что именно не сошлось (объём/расценка/пропуск/лишнее)
  const recon = useMemo(() => reconcilePositions(basket, smeta), [basket, smeta]);
  const checklist = useMemo(() => buildReconChecklist(recon), [recon]);
  const [onlyProblems, setOnlyProblems] = useState(true);
  const reconRows = useMemo(
    () => (onlyProblems ? recon.rows.filter((r) => r.status !== "ok") : recon.rows),
    [recon, onlyProblems],
  );

  if (!hydrated) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <Link href="/smeta-trainer/real-rates" className="text-xs text-blue-600 hover:underline">
              ← Реальные расценки
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">🧰 Своя смета из реальных позиций</h1>
            <p className="text-sm text-slate-600 mt-1">
              Соберите локальную смету из настоящих позиций Формы 4, задайте объёмы — итоги считаются
              ресурсным методом. Сохраняется локально.
            </p>
          </div>
          <Link
            href="/smeta-trainer/resource-quiz"
            className="text-xs px-3 py-2 bg-white border border-slate-300 rounded hover:bg-slate-100"
          >
            🧱 Тест по методу →
          </Link>
        </div>

        {/* ИТОГИ */}
        <div className="bg-slate-900 text-white rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Всего по смете</div>
              <div className="text-2xl font-bold font-mono">{formatKzt(totals.all)} ₸</div>
              <div className="text-[10px] text-slate-400">{basket.length} позиций</div>
            </div>
            {KINDS.map((k) => (
              <div key={k}>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{k}</div>
                <div className="font-mono text-sm">{formatKzt(totals.byKind[k])} ₸</div>
                <div className="text-[10px] text-slate-500">
                  {totals.all > 0 ? ((totals.byKind[k] / totals.all) * 100).toFixed(1) : "0"}%
                </div>
              </div>
            ))}
            {basket.length > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto text-[11px] px-2 py-1 border border-slate-600 rounded hover:bg-slate-800 text-slate-300"
              >
                ✕ очистить смету
              </button>
            )}
          </div>
        </div>

        {/* СРАВНЕНИЕ С ЭТАЛОННОЙ ЛС */}
        {fact["всего"] != null && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4">
            <h2 className="text-sm font-bold text-slate-800 mb-1">
              🎯 Сверка с эталонной ЛС {smeta.smetaNo ?? smeta.sheet}
              <span className="ml-2 text-[11px] font-normal text-slate-500">
                {(smeta.object ?? "").slice(0, 60)}
              </span>
            </h2>
            <p className="text-[10px] text-slate-400 mb-2 italic">
              Соберите эту ЛС целиком (все позиции из каталога справа с реальными объёмами), чтобы
              ваша смета сошлась с фактом. % — отношение вашей суммы к факту.
            </p>
            <table className="w-full text-[11px]">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-1">Показатель</th>
                  <th className="py-1 text-right">Факт (реальная ЛС)</th>
                  <th className="py-1 text-right">Моя смета</th>
                  <th className="py-1 text-right">Δ</th>
                  <th className="py-1 text-right">% от факта</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Всего", mine: totals.all, fact: fact["всего"] },
                  { label: "труд", mine: totals.byKind["труд"], fact: fact["труд"] },
                  { label: "машины", mine: totals.byKind["машины"], fact: fact["машины"] },
                  { label: "перевозки", mine: totals.byKind["перевозка"], fact: fact["перевозки"] },
                ].map((row) => {
                  const pct = matchPercent(row.mine, row.fact);
                  const delta = row.fact != null ? row.mine - row.fact : null;
                  const close = pct != null && Math.abs(pct - 100) <= 2;
                  return (
                    <tr key={row.label} className="border-t border-slate-100">
                      <td className="py-1 font-semibold text-slate-700">{row.label}</td>
                      <td className="py-1 text-right font-mono text-slate-500">
                        {row.fact != null ? `${formatKzt(row.fact)} ₸` : "—"}
                      </td>
                      <td className="py-1 text-right font-mono text-slate-800">{formatKzt(row.mine)} ₸</td>
                      <td className={`py-1 text-right font-mono ${delta && Math.abs(delta) > 1 ? "text-amber-700" : "text-slate-400"}`}>
                        {delta != null ? `${delta >= 0 ? "+" : ""}${formatKzt(delta)}` : "—"}
                      </td>
                      <td className={`py-1 text-right font-mono font-semibold ${
                        pct == null ? "text-slate-400" : close ? "text-emerald-700" : "text-amber-700"
                      }`}>
                        {pct != null ? `${pct.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ПОЗИЦИОННЫЙ РАЗБОР РАСХОЖДЕНИЙ */}
        {fact["всего"] != null && (
          <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-800">
                🔍 Разбор по позициям
                {recon.matchedPct != null && (
                  <span className={`ml-2 text-[11px] font-bold ${
                    recon.matchedPct >= 99 ? "text-emerald-700" : recon.matchedPct >= 50 ? "text-amber-700" : "text-red-700"
                  }`}>
                    {recon.matchedPct.toFixed(0)}% позиций сошлось
                  </span>
                )}
              </h2>
              <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(e) => setOnlyProblems(e.target.checked)}
                  className="accent-slate-700"
                />
                только расхождения
              </label>
            </div>

            {/* чек-лист «что сделать, чтобы свести» */}
            <div className={`rounded-md p-2.5 mb-2 border ${checklist.ready ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-slate-700">
                  {checklist.ready ? "✅ Готовность" : "📝 Чек-лист сведения"}
                </span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded overflow-hidden">
                  <div
                    className={`h-full ${checklist.readiness >= 99 ? "bg-emerald-500" : checklist.readiness >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${checklist.readiness}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-600">{checklist.readiness}%</span>
              </div>
              <p className="text-[11px] text-slate-600">{checklist.summary}</p>
              {checklist.items.length > 0 && (
                <ol className="mt-1.5 space-y-0.5">
                  {checklist.items.slice(0, 8).map((it) => (
                    <li key={`${it.status}-${it.code}`} className="flex items-start gap-1.5 text-[11px]">
                      <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${it.severity === "high" ? "bg-red-500" : "bg-amber-500"}`} />
                      <span className="text-slate-700">{it.text}</span>
                    </li>
                  ))}
                  {checklist.items.length > 8 && (
                    <li className="text-[10px] text-slate-400 italic pl-3">…и ещё {checklist.items.length - 8} — см. таблицу ниже</li>
                  )}
                </ol>
              )}
            </div>

            {/* сводка по статусам */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DIFF_ORDER.filter((s) => recon.counts[s] > 0).map((s) => (
                <span key={s} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${DIFF_META[s].chip}`}>
                  {DIFF_META[s].icon} {DIFF_META[s].label}: {recon.counts[s]}
                </span>
              ))}
            </div>

            {reconRows.length === 0 ? (
              <p className="text-[11px] text-emerald-700 italic py-3 text-center">
                {recon.counts.ok > 0
                  ? "🎉 Все позиции сошлись с эталоном — смета собрана верно."
                  : "Добавьте позиции этой ЛС в смету, чтобы увидеть разбор."}
              </p>
            ) : (
              <div className="max-h-[22rem] overflow-auto">
                <table className="w-full text-[11px]">
                  <thead style={{ top: "var(--aevion-header-h, 0px)" }} className="text-slate-500 text-left sticky top-0 bg-white">
                    <tr>
                      <th className="py-1">Статус</th>
                      <th className="py-1">Код / наименование</th>
                      <th className="py-1 text-right">Объём: эталон / мой</th>
                      <th className="py-1 text-right">Расценка: эталон / моя</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconRows.map((r) => {
                      const m = DIFF_META[r.status];
                      const fq = r.factQty != null ? formatKzt(r.factQty) : "—";
                      const mq = r.mineQty != null ? formatKzt(r.mineQty) : "—";
                      const fp = r.factUnitPrice != null ? `${formatKzt(r.factUnitPrice)} ₸` : "—";
                      const mp = r.mineUnitPrice != null ? `${formatKzt(r.mineUnitPrice)} ₸` : "—";
                      return (
                        <tr key={r.code} className={`border-t border-slate-100 align-top ${m.row}`}>
                          <td className="py-1.5 pr-2 whitespace-nowrap">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${m.chip}`}>
                              {m.icon} {m.label}
                            </span>
                          </td>
                          <td className="py-1.5 pr-2">
                            <code className="text-[10px] text-slate-900">{r.code}</code>
                            <div className="text-slate-600 leading-snug">{r.name}</div>
                            <div className="text-[10px] text-slate-500 italic mt-0.5">{r.note}</div>
                          </td>
                          <td className="py-1.5 text-right font-mono whitespace-nowrap text-slate-700">
                            {fq} / <span className={r.status === "qty" ? "font-bold text-amber-800" : ""}>{mq}</span>
                            <div className="text-[9px] text-slate-400">{r.unit}</div>
                          </td>
                          <td className="py-1.5 text-right font-mono whitespace-nowrap text-slate-700">
                            {fp} / <span className={r.status === "price" ? "font-bold text-red-700" : ""}>{mp}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* КОРЗИНА */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h2 className="text-sm font-bold text-slate-800 mb-2">📋 Моя смета</h2>
            {basket.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-8 text-center">
                Добавьте позиции из каталога справа кнопкой «+».
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="py-1">Код / наименование</th>
                    <th className="py-1 text-right w-24">Объём</th>
                    <th className="py-1 text-right w-24">Сумма, ₸</th>
                    <th className="py-1 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {basket.map((b) => (
                    <tr key={b.uid} className="border-t border-slate-100 align-top">
                      <td className="py-1.5">
                        <code className="text-[10px] text-slate-900">{b.code}</code>
                        <div className="text-slate-600 leading-snug">{b.name}</div>
                      </td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={b.qty}
                          onChange={(e) => setQty(b.uid, Math.max(0, Number(e.target.value) || 0))}
                          className="w-16 border border-slate-300 rounded px-1 py-0.5 text-right text-[11px]"
                        />
                        <div className="text-[9px] text-slate-400">{b.unit}</div>
                      </td>
                      <td className="py-1.5 text-right font-mono font-semibold text-emerald-700">
                        {formatKzt(b.unitPrice * b.qty)}
                      </td>
                      <td className="py-1.5 text-center">
                        <button
                          onClick={() => remove(b.uid)}
                          className="text-slate-400 hover:text-red-600"
                          title="Удалить"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* КАТАЛОГ РЕАЛЬНЫХ ПОЗИЦИЙ */}
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h2 className="text-sm font-bold text-slate-800 mb-2">🏗 Реальные позиции</h2>
            <div className="flex gap-2 mb-2">
              <select
                value={active}
                onChange={(e) => { setActive(Number(e.target.value)); }}
                className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs"
              >
                {DATA.smety.map((s, i) => (
                  <option key={s.sheet} value={i}>
                    ЛС {s.smetaNo ?? s.sheet} — {(s.object ?? "").slice(0, 40)} ({s.positions.length})
                  </option>
                ))}
              </select>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск"
                aria-label="Поиск по расценкам"
                className="w-28 border border-slate-300 rounded px-2 py-1.5 text-xs"
              />
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {positions.slice(0, 300).map((p) => {
                    const kpu = kindPerUnitOf(p);
                    return (
                      <tr key={p.n} className="border-t border-slate-100 align-top hover:bg-slate-50">
                        <td className="py-1.5 pr-2">
                          <code className="text-[10px] text-slate-900">{p.code}</code>
                          <div className="text-slate-600 leading-snug">{p.name}</div>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {KINDS.filter((k) => kpu[k] > 0).map((k) => (
                              <span key={k} className={`text-[8px] px-1 rounded-full font-semibold ${KIND_BADGE[k]}`}>
                                {k}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap text-slate-600">
                          <div className="font-mono">{formatKzt(p.unitPrice)} ₸</div>
                          <div className="text-[9px] text-slate-400">/{p.unit}</div>
                        </td>
                        <td className="py-1.5 text-center">
                          <button
                            onClick={() => addPosition(p)}
                            className="px-2 py-1 text-[10px] font-bold bg-emerald-600 text-white rounded hover:bg-emerald-700"
                            title={`Добавить (объём по умолчанию ${formatKzt(p.qty)})`}
                            aria-label={`Добавить в смету: ${p.name}`}
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {positions.length === 0 && (
                    <tr><td className="py-6 text-center text-slate-400 italic">Ничего не найдено</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {positions.length > 300 && (
              <p className="text-[10px] text-slate-400 mt-1 italic">
                Показаны первые 300 из {positions.length}. Уточните поиск.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
