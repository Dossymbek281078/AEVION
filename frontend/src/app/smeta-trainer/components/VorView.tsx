"use client";

import type { Lsr, LearningObject, SmetaPosition } from "../lib/types";
import { findRate } from "../lib/corpus";

interface Props {
  lsr: Lsr;
  object: LearningObject | undefined;
  onUpdatePosition: (sectionId: string, posId: string, patch: Partial<SmetaPosition>) => void;
}

function GeomRef({ obj }: { obj: LearningObject }) {
  const g = obj.geometry;
  if (!g) return null;

  const wallArea = (2 * (g.length + g.width)) * g.height;
  const openingArea = g.openings.reduce(
    (s, o) => s + o.width * o.height * o.count,
    0
  );
  const netWallArea = wallArea - openingArea;
  const floorArea = g.length * g.width;

  // Для крыла Б — специальный множитель
  const wingData = (obj as unknown as { _wingData?: Record<string, number> })._wingData;
  const roomCount = wingData?.roomsTotal ?? 1;
  const label = roomCount > 1 ? `(× ${roomCount} помещений)` : "";

  return (
    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs space-y-2">
      <div className="font-semibold text-blue-800">
        Геометрия объекта — справка для ВОР {label}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
        <div>
          Размеры: {g.length} × {g.width} м, h = {g.height} м
        </div>
        <div>Площадь пола: {floorArea.toFixed(2)} м²</div>
        <div>
          Площадь стен (брутто): {wallArea.toFixed(2)} м²
        </div>
        <div>
          Проёмы: −{openingArea.toFixed(2)} м²
          <span className="text-slate-400 ml-1">
            ({g.openings.map((o) => `${o.kind} ${o.width}×${o.height} × ${o.count}`).join(", ")})
          </span>
        </div>
        <div className="font-semibold">
          Площадь стен нетто: {netWallArea.toFixed(2)} м²
        </div>
        {roomCount > 1 && (
          <div className="font-semibold text-blue-700">
            × {roomCount} = {(netWallArea * roomCount).toFixed(2)} м² всего
          </div>
        )}
      </div>
      {wingData && (
        <div className="text-slate-500 pt-1 border-t border-blue-200">
          Крыло: {wingData.floorsCount} эт. × {wingData.roomsPerFloor} кл. = {wingData.roomsTotal} помещений ·
          Коридор: {wingData.corridorLength} × {wingData.corridorWidth} м × {wingData.floorsCount} эт. ·
          Итого площадь ≈ {wingData.totalFloorArea} м²
        </div>
      )}
    </div>
  );
}

export function VorView({ lsr, object, onUpdatePosition }: Props) {
  // Собираем все позиции из всех разделов
  const allPositions = lsr.sections.flatMap((s) =>
    s.positions.map((p) => ({ section: s, position: p }))
  );

  if (allPositions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400 text-sm">
        Смета пуста. Добавьте позиции на вкладке «ЛСР», затем вернитесь сюда для заполнения ВОР.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      {/* Шапка ВОР */}
      <div className="border border-slate-300 bg-white">
        <div className="flex justify-between border-b border-slate-200 px-3 py-1 bg-slate-50 text-xs">
          <span className="text-slate-400">НДЦС РК 8.01-08-2022. Приложение Г.</span>
          <span className="font-semibold text-slate-600">Приложение к Форме 4*</span>
        </div>
        <div className="px-4 py-2">
          <div className="font-semibold text-sm text-slate-800">
            ВЕДОМОСТЬ ОБЪЁМОВ РАБОТ (ВОР)
          </div>
          <div className="text-xs text-slate-500 mt-0.5">к {lsr.title}</div>
        </div>
      </div>

      {/* Геометрия объекта */}
      {object && <GeomRef obj={object} />}

      {/* Пояснение */}
      <div className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded px-3 py-2">
        <strong>Учебное задание.</strong> Для каждой позиции запишите формулу подсчёта объёма и ссылку на чертёж.
        Формат формулы: <em>«(длина × ширина × кол-во) − проёмы = итого»</em>.
        Итоговый объём должен совпадать с полем «Количество» в таблице ЛСР.
      </div>

      {/* Таблица ВОР */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-600 w-8">№</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 w-28">Шифр расценки</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600">Наименование работ</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-600 w-16">Ед. изм.</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left text-[10px] font-semibold text-slate-600 w-56">
              Формула / расчёт объёма
              <div className="text-[9px] font-normal text-slate-400">(ссылка на чертёж)</div>
            </th>
            <th className="border border-slate-300 px-2 py-1.5 text-center text-[10px] font-semibold text-slate-600 w-20">Итого</th>
          </tr>
        </thead>
        <tbody>
          {lsr.sections.map((section) => {
            if (section.positions.length === 0) return null;
            return (
              <>
                {/* Строка раздела */}
                <tr key={`sec-${section.id}`} className="bg-slate-50">
                  <td className="border border-slate-200 px-2 py-1" />
                  <td
                    colSpan={5}
                    className="border border-slate-200 px-2 py-1 font-semibold text-slate-700"
                  >
                    {section.title}
                  </td>
                </tr>

                {/* Позиции */}
                {section.positions.map((pos, idx) => {
                  const rate = findRate(pos.rateCode);
                  return (
                    <tr key={pos.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 font-mono text-[10px] text-slate-600">
                        {pos.rateCode}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 text-slate-800">
                        {rate?.title ?? pos.rateCode}
                      </td>
                      <td className="border border-slate-200 px-2 py-1 text-center font-mono text-slate-600">
                        {rate?.unit ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        <input
                          className="w-full text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 placeholder:text-slate-300"
                          placeholder="например: (30 × 3.2 − 5.67) × 32 = 2 891 м²"
                          value={pos.formula ?? ""}
                          onChange={(e) =>
                            onUpdatePosition(section.id, pos.id, {
                              formula: e.target.value,
                            })
                          }
                        />
                        <input
                          className="w-full text-[10px] border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 mt-0.5 text-slate-400 placeholder:text-slate-200"
                          placeholder="чертёж / лист / ось"
                          value={pos.drawingRef ?? ""}
                          onChange={(e) =>
                            onUpdatePosition(section.id, pos.id, {
                              drawingRef: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="border border-slate-200 px-2 py-1 text-center font-mono font-semibold text-slate-900">
                        {pos.volume}
                        <div className="text-[9px] font-normal text-slate-400">
                          {rate?.unit}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            );
          })}
        </tbody>
      </table>

      <div className="text-[10px] text-slate-400 italic">
        * Объёмы, указанные в колонке «Итого», берутся из поля «Количество» ЛСР.
        Для изменения объёма вернитесь на вкладку «ЛСР».
      </div>
    </div>
  );
}
