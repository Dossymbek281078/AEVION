"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  cacheSharedOverrides,
  clearOverride,
  listMatched,
  listOverrides,
  listUnmatched,
  materialMapMeta,
  setOverride,
  type MaterialOverride,
} from "../../lib/materialPrices";
import { formatTenge } from "../../lib/ssc";
import { SscPicker } from "../../components/SscPicker";
import { fetchSharedOverrides } from "../../lib/progressApi";

type Tab = "matched" | "unmatched" | "overrides";

export default function SscMappingPage() {
  const [tab, setTab] = useState<Tab>("matched");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<{ name: string; unit: string } | null>(null);
  const [overrides, setOverrides] = useState<MaterialOverride[]>([]);

  // overrides доступны только в браузере — обновляем при mount + после изменений
  const refreshOverrides = () => setOverrides(listOverrides());
  useEffect(() => {
    // Сначала пробуем подтянуть shared с backend (тихо игнорим если оффлайн)
    fetchSharedOverrides()
      .then((arr) => {
        cacheSharedOverrides(arr.map((o) => ({ ...o, source: "shared" as const })));
        refreshOverrides();
      })
      .catch(() => {
        // backend недоступен — остаются только local
        refreshOverrides();
      });
  }, []);

  const matched = listMatched();
  const unmatched = listUnmatched();
  const overrideKeys = useMemo(
    () => new Set(overrides.map((o) => `${o.name.toLowerCase()}|${o.unit}`)),
    [overrides],
  );

  // unmatched но без user-override (чтобы не дублировать в трёх вкладках)
  const unmatchedActive = useMemo(
    () => unmatched.filter((m) => !overrideKeys.has(`${m.name.toLowerCase()}|${m.unit}`)),
    [unmatched, overrideKeys],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === "matched") {
      if (!q) return matched;
      return matched.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.sscName.toLowerCase().includes(q) ||
          m.sscCode.includes(q),
      );
    }
    if (tab === "unmatched") {
      if (!q) return unmatchedActive;
      return unmatchedActive.filter((m) => m.name.toLowerCase().includes(q));
    }
    if (!q) return overrides;
    return overrides.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.sscCode ?? "").includes(q) ||
      (o.sscName ?? "").toLowerCase().includes(q),
    );
  }, [tab, query, matched, unmatchedActive, overrides]);

  const totalMatched = materialMapMeta.matched + overrides.filter((o) => o.sscCode !== null).length;
  const coverage = Math.round((totalMatched / materialMapMeta.total) * 100);
  const baseCoverage = Math.round((materialMapMeta.matched / materialMapMeta.total) * 100);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/smeta-trainer/ssc"
            className="text-xs text-slate-500 hover:text-slate-900"
          >
            ← К справочнику ССЦ
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Привязка учебных материалов к ССЦ РК 8.04-08-2025
            </h1>
            <p className="text-[11px] text-slate-500">
              {materialMapMeta.total} уникальных материалов ·{" "}
              <span className="text-emerald-600 font-semibold">
                {materialMapMeta.matched} auto
              </span>
              {overrides.length > 0 && (
                <>
                  {" "}+{" "}
                  <span className="text-blue-600 font-semibold">
                    {overrides.filter((o) => o.sscCode !== null).length} вручную
                  </span>
                </>
              )}{" "}
              · покрытие {coverage}% (auto {baseCoverage}%)
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setTab("matched")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${
                  tab === "matched"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ✓ Auto-сматчено · {matched.length}
              </button>
              <button
                onClick={() => setTab("unmatched")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${
                  tab === "unmatched"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ⚠ Без привязки · {unmatchedActive.length}
              </button>
              <button
                onClick={() => setTab("overrides")}
                className={`px-3 py-1.5 text-xs font-semibold rounded ${
                  tab === "overrides"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                ✋ Вручную · {overrides.length}
              </button>
            </div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="border rounded px-3 py-1.5 text-sm w-64"
            />
          </div>

          <div className="overflow-auto border rounded">
            {tab === "matched" && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600 uppercase text-[10px]">
                    <th className="px-2 py-2">Материал в seed</th>
                    <th className="px-2 py-2 w-16">Ед.</th>
                    <th className="px-2 py-2 w-28">ССЦ-код</th>
                    <th className="px-2 py-2">Соответствие в ССЦ</th>
                    <th className="px-2 py-2 w-16 text-center">Скор</th>
                    <th className="px-2 py-2 w-28 text-right">Сметная</th>
                    <th className="px-2 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as ReturnType<typeof listMatched>).map((m, i) => (
                    <tr key={i} className="border-t hover:bg-emerald-50/40">
                      <td className="px-2 py-1.5 text-slate-900">{m.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">{m.unit}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-700">
                        {m.sscCode}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">{m.sscName}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            m.score >= 0.7
                              ? "bg-emerald-100 text-emerald-700"
                              : m.score >= 0.5
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {m.score.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                        {formatTenge(m.smetnaya)}
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => setPicking({ name: m.name, unit: m.unit })}
                          className="text-[10px] text-slate-500 hover:text-blue-700 underline"
                          title="Заменить привязку вручную"
                        >
                          Изменить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "unmatched" && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600 uppercase text-[10px]">
                    <th className="px-2 py-2">Материал в seed</th>
                    <th className="px-2 py-2 w-16">Ед.</th>
                    <th className="px-2 py-2">Причина</th>
                    <th className="px-2 py-2 w-32"></th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as ReturnType<typeof listUnmatched>).map((m, i) => (
                    <tr key={i} className="border-t hover:bg-amber-50/40">
                      <td className="px-2 py-1.5 text-slate-900">{m.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">{m.unit}</td>
                      <td className="px-2 py-1.5 text-slate-400 text-[11px]">
                        {m.reason ?? "Нет совпадения по названию + единице"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          onClick={() => setPicking({ name: m.name, unit: m.unit })}
                          className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-semibold rounded hover:bg-emerald-700"
                        >
                          🔗 Привязать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === "overrides" && (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left text-slate-600 uppercase text-[10px]">
                    <th className="px-2 py-2">Материал в seed</th>
                    <th className="px-2 py-2 w-16">Ед.</th>
                    <th className="px-2 py-2 w-28">ССЦ-код</th>
                    <th className="px-2 py-2">Привязано к</th>
                    <th className="px-2 py-2 w-28 text-right">Сметная</th>
                    <th className="px-2 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {(filtered as MaterialOverride[]).map((o, i) => (
                    <tr key={i} className="border-t hover:bg-blue-50/40">
                      <td className="px-2 py-1.5 text-slate-900">{o.name}</td>
                      <td className="px-2 py-1.5 text-slate-600">{o.unit}</td>
                      <td className="px-2 py-1.5 font-mono text-slate-700">
                        {o.sscCode ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">
                        {o.sscCode === null ? (
                          <span className="text-amber-600 italic">
                            не нормируется ССЦ
                          </span>
                        ) : (
                          o.sscName ?? "(без названия)"
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-emerald-700 font-semibold tabular-nums">
                        {o.smetnaya != null ? formatTenge(o.smetnaya) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {o.source === "shared" ? (
                          <span
                            className="text-[10px] text-blue-600"
                            title="Привязка от куратора курса (shared)"
                          >
                            🔒 куратор
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              clearOverride(o.name, o.unit);
                              refreshOverrides();
                            }}
                            className="text-[10px] text-red-500 hover:text-red-700 underline"
                            title="Удалить локальный override"
                          >
                            Удалить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {overrides.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                        Пока нет ручных привязок. Перейдите во вкладку «Без привязки»
                        и нажмите «🔗 Привязать» рядом с материалом.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="text-[11px] text-slate-400 mt-3">
            Auto-привязки: скор &lt; 0.5 — натянуто, требует проверки. Ручные привязки
            хранятся в localStorage этого браузера. Сгенерировано {materialMapMeta.generatedAt}.
          </div>
        </div>
      </div>

      {picking && (
        <SscPicker
          seedName={picking.name}
          seedUnit={picking.unit}
          onPick={(row) => {
            setOverride({
              name: picking.name,
              unit: picking.unit,
              sscCode: row.code,
              sscName: row.name,
              smetnaya: row.smetnaya ?? undefined,
              otpusknaya: row.otpusknaya ?? null,
              sscBook: row.bookSlug,
            });
            refreshOverrides();
            setPicking(null);
            setTab("overrides");
          }}
          onSkip={() => {
            setOverride({
              name: picking.name,
              unit: picking.unit,
              sscCode: null,
            });
            refreshOverrides();
            setPicking(null);
            setTab("overrides");
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
