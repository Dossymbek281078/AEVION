"use client";

/**
 * Акт освидетельствования скрытых работ.
 * Оформляется на работы, скрываемые последующими (армирование перед бетонированием,
 * гидроизоляция перед обратной засыпкой, проводка в штробах перед штукатуркой).
 * Обязателен в строительстве — без него нельзя продолжать следующий этап.
 *
 * СН РК 1.03-00 + Приказ МНЭ РК № 230 от 2015 + СП РК 1.03-30 (учебная адаптация).
 */

import { useState } from "react";
import type { LsrCalc } from "../lib/types";

interface Props {
  calc: LsrCalc;
}

interface HiddenWork {
  id: string;
  description: string;
  materials: string;
  norms: string;
  volume: string;
  unit: string;
}

const PRESETS: { label: string; work: Omit<HiddenWork, "id"> }[] = [
  {
    label: "Армирование фундамента",
    work: {
      description: "Установка арматурного каркаса фундаментной плиты до бетонирования",
      materials: "Арматура А-III A500 Ø16 (продольная), Ø8 А-III (поперечная)",
      norms: "СН РК 5.03-37 «Бетонные и железобетонные конструкции», ГОСТ 5781-82",
      volume: "5.8",
      unit: "т",
    },
  },
  {
    label: "Гидроизоляция фундамента",
    work: {
      description: "Окрасочная гидроизоляция фундамента битумной мастикой в 2 слоя перед обратной засыпкой",
      materials: "Мастика битумная Технониколь №21, праймер №01",
      norms: "СН РК 4.03-14 «Гидроизоляция»",
      volume: "120",
      unit: "м²",
    },
  },
  {
    label: "Скрытая электропроводка",
    work: {
      description: "Прокладка кабельных трасс в штробах стен и потолков до штукатурных работ",
      materials: "Кабель ВВГнг-LS 3×2.5 мм², гофротруба ПВХ Ø20",
      norms: "ПУЭ-7, СН РК 4.04-09",
      volume: "350",
      unit: "м",
    },
  },
];

export function HiddenWorksActView({ calc }: Props) {
  const [actNumber, setActNumber] = useState("1");
  const [work, setWork] = useState<HiddenWork>({ id: "1", ...PRESETS[0].work });

  return (
    <div className="space-y-3 text-slate-700 print:text-black">
      <div className="flex gap-2 flex-wrap print:hidden">
        <span className="text-xs text-slate-500 self-center">Шаблоны:</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setWork({ id: work.id, ...preset.work })}
            className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 rounded"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="border border-slate-200 rounded-lg bg-white p-6 print:border-0 print:p-0">
        <div className="text-center space-y-1 mb-4">
          <div className="text-xs uppercase tracking-wider text-slate-500 print:text-slate-700">
            СН РК 1.03-00, форма АОСР-1
          </div>
          <div className="text-lg font-bold uppercase">
            Акт освидетельствования скрытых работ № {actNumber}
          </div>
          <div className="text-xs text-slate-500">
            (АОСР)
          </div>
        </div>

        {/* Шапка */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-4 border-y border-slate-200 py-3">
          <div className="space-y-1">
            <div>
              <span className="text-slate-500">Объект:</span> {calc.lsr.meta?.objectTitle ?? "________________"}
            </div>
            <div>
              <span className="text-slate-500">Адрес:</span> ________________
            </div>
            <div>
              <span className="text-slate-500">Заказчик:</span> ________________
            </div>
            <div>
              <span className="text-slate-500">Подрядчик:</span> ________________
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex gap-2 items-baseline">
              <span className="text-slate-500 shrink-0">№ акта:</span>
              <input
                value={actNumber}
                onChange={(e) => setActNumber(e.target.value)}
                className="border-b border-slate-300 bg-transparent px-1 text-xs outline-none w-12"
              />
            </div>
            <div>
              <span className="text-slate-500">Дата:</span>{" "}
              {new Date().toLocaleDateString("ru-RU")}
            </div>
            <div>
              <span className="text-slate-500">Авторский надзор:</span> ________________
            </div>
            <div>
              <span className="text-slate-500">Технадзор:</span> ________________
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-700 mb-4 leading-relaxed">
          Комиссия в составе представителей заказчика, технического надзора и подрядной организации
          составила настоящий акт о том, что на объекте «<strong>{calc.lsr.meta?.objectTitle ?? "________________"}</strong>»
          выполнены следующие скрытые работы:
        </div>

        {/* Описание работ */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">1. К освидетельствованию предъявлены следующие работы:</label>
            <textarea
              value={work.description}
              onChange={(e) => setWork({ ...work, description: e.target.value })}
              className="w-full border border-slate-300 rounded p-2 text-xs print:border-0 print:p-0"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-500 mb-1">Объём работ:</label>
              <div className="flex gap-2">
                <input
                  value={work.volume}
                  onChange={(e) => setWork({ ...work, volume: e.target.value })}
                  className="flex-1 border border-slate-300 rounded p-2 text-xs print:border-0 print:p-0"
                />
                <input
                  value={work.unit}
                  onChange={(e) => setWork({ ...work, unit: e.target.value })}
                  className="w-16 border border-slate-300 rounded p-2 text-xs print:border-0 print:p-0"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">2. Применённые материалы и изделия:</label>
            <textarea
              value={work.materials}
              onChange={(e) => setWork({ ...work, materials: e.target.value })}
              className="w-full border border-slate-300 rounded p-2 text-xs print:border-0 print:p-0"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1">3. Работы выполнены в соответствии с проектом и СНиП:</label>
            <textarea
              value={work.norms}
              onChange={(e) => setWork({ ...work, norms: e.target.value })}
              className="w-full border border-slate-300 rounded p-2 text-xs print:border-0 print:p-0"
              rows={2}
            />
          </div>
        </div>

        {/* Решение комиссии */}
        <div className="text-xs text-slate-700 mt-4 leading-relaxed border-t border-slate-200 pt-4">
          <strong>Решение комиссии:</strong> На основании предъявленной исполнительной документации и
          осмотра скрытых работ комиссия <em>разрешает / не разрешает</em> производство последующих работ.
          <br />
          Качество выполненных работ <em>соответствует / не соответствует</em> требованиям проекта и норм.
        </div>

        {/* Подписи */}
        <div className="grid grid-cols-3 gap-6 text-xs pt-6 mt-4 border-t border-slate-200">
          <div className="space-y-2">
            <div className="font-semibold uppercase">Представитель заказчика</div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">ФИО:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">Подпись:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold uppercase">Технадзор</div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">ФИО:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">Подпись:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-semibold uppercase">Подрядчик</div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">ФИО:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
            <div className="flex gap-2 items-baseline">
              <span className="shrink-0">Подпись:</span>
              <div className="flex-1 border-b border-slate-300" />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm print:hidden"
      >
        🖨 Распечатать АОСР
      </button>
    </div>
  );
}
