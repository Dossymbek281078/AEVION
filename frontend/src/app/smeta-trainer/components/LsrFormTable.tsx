"use client";

import { Fragment, useState } from "react";
import type { LsrCalc, AiNotice, AppliedCoefficient } from "../lib/types";
import { formatKzt } from "../lib/calc";
import { CoefBadge } from "./CoefBadge";

interface Props {
  calc: LsrCalc;
  notices: AiNotice[];
  onChangeVolume: (sectionId: string, posId: string, vol: number) => void;
  onRemove: (sectionId: string, posId: string) => void;
  onUpdateCoefs?: (sectionId: string, posId: string, coefs: AppliedCoefficient[]) => void;
}

const TH = "px-2 py-1 text-[10px] font-semibold text-slate-600 border border-slate-300 bg-slate-100 text-center whitespace-nowrap";
const TD = "px-2 py-1 text-xs border border-slate-200";

export function LsrFormTable({ calc, notices, onChangeVolume, onRemove, onUpdateCoefs }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  let posCounter = 0;

  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full border-collapse text-xs print:text-[9pt]" style={{ minWidth: 800 }}>
        <thead>
          <tr>
            <th className={TH} style={{ width: 36 }}>№<br />п/п</th>
            <th className={TH} style={{ width: 120 }}>Обоснование</th>
            <th className={TH} style={{ minWidth: 260 }}>Наименование работ и затрат</th>
            <th className={TH} style={{ width: 60 }}>Ед.<br />изм.</th>
            <th className={TH} style={{ width: 72 }}>Коли-<br />чество</th>
            <th className={TH} style={{ width: 110 }}>Стоимость ед.,<br />тенге</th>
            <th className={TH} style={{ width: 110 }}>Общая стоимость,<br />тенге</th>
            <th className={TH} style={{ width: 28 }} />
          </tr>
          <tr>
            {[1, 2, 3, 4, 5, 6, 7, ""].map((n, i) => (
              <td key={i} className="border border-slate-300 text-center text-[10px] text-slate-400 py-0.5">{n}</td>
            ))}
          </tr>
        </thead>

        <tbody>
          {calc.sections.map((sc) => {
            const sectionNotices = notices.filter((n) => n.context.sectionId === sc.section.id);

            return (
              <Fragment key={sc.section.id}>
                {/* Строка раздела */}
                <tr className="bg-slate-50">
                  <td className={`${TD} text-center text-slate-400`} />
                  <td className={TD} />
                  <td colSpan={4} className={`${TD} font-semibold text-slate-800`}>{sc.section.title}</td>
                  <td className={`${TD} text-right font-semibold font-mono text-slate-800`}>
                    {sc.direct > 0 ? formatKzt(sc.direct) : ""}
                  </td>
                  <td className={TD} />
                </tr>

                {sectionNotices.map((n) => (
                  <tr key={`sn-${n.id}`}>
                    <td />
                    <td colSpan={6}>
                      <div className={`text-[10px] px-2 py-0.5 ${n.severity === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                        ⚠ {n.title}: {n.message}
                      </div>
                    </td>
                    <td />
                  </tr>
                ))}

                {sc.positions.map((p) => {
                  posCounter += 1;
                  const num = posCounter;
                  const posNotices = notices.filter((n) => n.context.positionId === p.position.id);
                  const hasError = posNotices.some((n) => n.severity === "error");
                  const isExpanded = expanded.has(p.position.id);
                  const hasCoefs = p.position.coefficients.length > 0;
                  const coefMul = p.appliedCoefMultiplier;

                  return (
                    <Fragment key={p.position.id}>
                      <tr className={hasError ? "bg-red-50" : "hover:bg-slate-50 group"}>
                        <td className={`${TD} text-center text-slate-600`}>{num}</td>
                        <td className={`${TD} font-mono text-[10px] text-slate-600 leading-tight`}>
                          {p.rate.code}
                        </td>
                        <td className={TD}>
                          <div className="flex items-start gap-1">
                            <button
                              onClick={() => toggleExpand(p.position.id)}
                              className="text-slate-400 hover:text-emerald-600 text-[10px] mt-0.5 shrink-0 w-3"
                              title={isExpanded ? "Свернуть «из них»" : "Раскрыть «из них»"}
                            >
                              {isExpanded ? "▾" : "▸"}
                            </button>
                            <div className="min-w-0">
                              <div className={hasError ? "text-red-800" : "text-slate-900"}>
                                {p.rate.title}
                              </div>
                              {posNotices.map((n) => (
                                <div key={n.id} className="text-[10px] text-red-600 mt-0.5">⚠ {n.title}</div>
                              ))}
                              {/* Коэффициенты */}
                              <div className="mt-1">
                                <CoefBadge
                                  coefficients={p.position.coefficients}
                                  onChange={onUpdateCoefs
                                    ? (c) => onUpdateCoefs(sc.section.id, p.position.id, c)
                                    : () => {}}
                                  disabled={!onUpdateCoefs}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} text-center text-slate-600 font-mono`}>{p.rate.unit}</td>
                        <td className={`${TD} text-center`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              value={p.position.volume}
                              onChange={(e) => onChangeVolume(sc.section.id, p.position.id, parseFloat(e.target.value) || 0)}
                              className={`w-16 text-right text-xs font-mono border rounded px-1 py-0.5 focus:outline-none focus:ring-1 ${
                                hasError ? "border-red-400 bg-red-50 focus:ring-red-400" : "border-slate-300 focus:ring-emerald-500"
                              }`}
                            />
                            {hasCoefs && (
                              <span className="text-[9px] text-amber-600 font-mono">×{coefMul.toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className={`${TD} text-right font-mono text-slate-700`}>{formatKzt(p.unitPrice)}</td>
                        <td className={`${TD} text-right font-mono font-semibold text-slate-900`}>
                          {formatKzt(p.current.direct)}
                          {hasCoefs && (
                            <div className="text-[9px] text-amber-600 font-normal text-right">вкл. К={coefMul.toFixed(2)}</div>
                          )}
                        </td>
                        <td className={`${TD} text-center`}>
                          <button
                            onClick={() => onRemove(sc.section.id, p.position.id)}
                            className="text-slate-300 hover:text-red-500 text-[11px] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Удалить позицию"
                          >✕</button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <Fragment>
                          <tr className="bg-slate-50/60">
                            <td className={`${TD} text-center text-slate-300 text-[10px]`}>{num}.1</td>
                            <td className={TD} />
                            <td className={`${TD} text-slate-500 pl-6`}>
                              <span className="text-slate-400 mr-1">из них:</span>затраты на труд рабочих
                            </td>
                            <td className={`${TD} text-center text-slate-400 font-mono text-[10px]`}>тнг.</td>
                            <td className={TD} /><td className={TD} />
                            <td className={`${TD} text-right font-mono text-slate-600`}>{formatKzt(p.current.fot)}</td>
                            <td className={TD} />
                          </tr>
                          {p.current.em > 0 && (
                            <tr className="bg-slate-50/60">
                              <td className={`${TD} text-center text-slate-300 text-[10px]`}>{num}.2</td>
                              <td className={TD} />
                              <td className={`${TD} text-slate-500 pl-6`}>машины и механизмы</td>
                              <td className={`${TD} text-center text-slate-400 font-mono text-[10px]`}>тнг.</td>
                              <td className={TD} /><td className={TD} />
                              <td className={`${TD} text-right font-mono text-slate-600`}>{formatKzt(p.current.em)}</td>
                              <td className={TD} />
                            </tr>
                          )}
                          {p.current.materials > 0 && (
                            <tr className="bg-slate-50/60">
                              <td className={`${TD} text-center text-slate-300 text-[10px]`}>{num}.{p.current.em > 0 ? 3 : 2}</td>
                              <td className={TD} />
                              <td className={`${TD} text-slate-500 pl-6`}>материалы, изделия и конструкции</td>
                              <td className={`${TD} text-center text-slate-400 font-mono text-[10px]`}>тнг.</td>
                              <td className={TD} /><td className={TD} />
                              <td className={`${TD} text-right font-mono text-slate-600`}>{formatKzt(p.current.materials)}</td>
                              <td className={TD} />
                            </tr>
                          )}
                        </Fragment>
                      )}
                    </Fragment>
                  );
                })}

                {sc.positions.length > 0 && (
                  <tr className="bg-slate-100">
                    <td className={TD} /><td className={TD} />
                    <td colSpan={4} className={`${TD} font-semibold text-slate-700 text-right`}>Итого прямых затрат по разделу:</td>
                    <td className={`${TD} text-right font-bold font-mono text-slate-900`}>{formatKzt(sc.direct)}</td>
                    <td className={TD} />
                  </tr>
                )}

                {sc.positions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="border border-slate-200 py-6 text-center">
                      <div className="text-slate-400 text-xs italic">Раздел пуст</div>
                      <div className="text-[11px] text-slate-300 mt-1">← Найдите расценку в левой панели и нажмите на неё</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}

          {calc.sections.some((s) => s.positions.length > 0) && (
            <tr className="bg-emerald-50">
              <td className={TD} /><td className={TD} />
              <td colSpan={4} className={`${TD} font-bold text-slate-800 text-right uppercase`}>ВСЕГО ПО СМЕТЕ (прямые затраты):</td>
              <td className={`${TD} text-right font-bold font-mono text-emerald-800 text-sm`}>
                {formatKzt(calc.sections.reduce((s, sc) => s + sc.direct, 0))}
              </td>
              <td className={TD} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
