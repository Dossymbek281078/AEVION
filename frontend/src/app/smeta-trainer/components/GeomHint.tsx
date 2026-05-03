"use client";

import { useState } from "react";
import type { LearningObject } from "../lib/types";

interface Props {
  object: LearningObject | undefined;
}

export function GeomHint({ object }: Props) {
  const [open, setOpen] = useState(false);
  const g = object?.geometry;
  if (!g) return null;

  const wallBrutto = (2 * (g.length + g.width)) * g.height;
  const openingsArea = g.openings.reduce((s, o) => s + o.width * o.height * o.count, 0);
  const wallNetto = wallBrutto - openingsArea;
  const floor = g.length * g.width;

  const wingData = (object as { _wingData?: Record<string, number> })._wingData;
  const n = wingData?.roomsTotal ?? 1;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-emerald-600 hover:text-emerald-700 underline"
      >
        📐 Геометрия объекта
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-3 w-72 text-xs space-y-1.5">
            <div className="font-semibold text-slate-700 mb-1">{object?.title}</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
              <span className="text-slate-400">Помещений:</span>
              <span className="font-mono">{n} шт</span>
              <span className="text-slate-400">Размер:</span>
              <span className="font-mono">{g.length}×{g.width}×{g.height} м</span>
              <span className="text-slate-400">Площадь пола:</span>
              <span className="font-mono">{floor.toFixed(2)} м² × {n} = <strong>{(floor * n).toFixed(0)} м²</strong></span>
              <span className="text-slate-400">Стены брутто:</span>
              <span className="font-mono">{wallBrutto.toFixed(2)} м²</span>
              <span className="text-slate-400">Проёмы (−):</span>
              <span className="font-mono">{openingsArea.toFixed(2)} м²</span>
              <span className="text-slate-400">Стены нетто:</span>
              <span className="font-mono font-semibold text-emerald-700">{wallNetto.toFixed(2)} м² × {n} = <strong>{(wallNetto * n).toFixed(0)} м²</strong></span>
            </div>
            <div className="pt-1.5 border-t border-slate-100 text-slate-400 space-y-0.5">
              {g.openings.map((o, i) => (
                <div key={i}>{o.kind === "window" ? "Окна" : "Двери"}: {o.count} × {o.width}×{o.height} = {(o.width * o.height * o.count).toFixed(2)} м²</div>
              ))}
            </div>
            <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400 italic">
              Используйте эти цифры при заполнении поля «Количество» и формул ВОР.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
