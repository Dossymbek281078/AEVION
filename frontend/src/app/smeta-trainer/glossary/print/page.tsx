"use client";

import Link from "next/link";
import { CATEGORIES, GLOSSARY } from "../../lib/glossary";

/**
 * Печатный глоссарий — A4 portrait, компактно, для офлайн-чтения.
 * Все 40 терминов сгруппированы по категориям.
 */
export default function GlossaryPrintPage() {
  // Группировка по категориям с сохранением порядка из CATEGORIES
  const byCat = new Map<string, typeof GLOSSARY>();
  for (const cat of CATEGORIES) byCat.set(cat.id, []);
  for (const e of GLOSSARY) byCat.get(e.category)?.push(e);

  return (
    <div className="min-h-screen bg-slate-100 print:bg-white p-4 print:p-0">
      {/* Toolbar */}
      <div className="max-w-3xl mx-auto mb-3 flex items-center justify-between print:hidden">
        <Link href="/smeta-trainer/glossary" className="text-xs text-slate-500 hover:text-slate-900">
          ← К интерактивному глоссарию
        </Link>
        <button
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700"
        >
          🖨 Печать / PDF (A4)
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white border border-slate-300 rounded-lg shadow-sm print:shadow-none print:border-0 p-6">
        {/* Заголовок */}
        <div className="text-center mb-4 pb-3 border-b-2 border-emerald-600">
          <div className="text-xs font-bold text-emerald-700 uppercase tracking-[0.2em]">
            AEVION · Сметный тренажёр РК
          </div>
          <h1 className="text-base font-bold text-slate-900 mt-1">
            Глоссарий сметных терминов РК
          </h1>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {GLOSSARY.length} терминов · НДЦС РК 8.01-08-2022, СН РК 8.02
          </div>
        </div>

        {/* Категории */}
        {CATEGORIES.map((cat) => {
          const items = byCat.get(cat.id) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="mb-3 print:break-inside-avoid">
              <h2 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1.5 border-b border-emerald-200 pb-0.5">
                {cat.icon} {cat.label}
              </h2>
              <div className="space-y-1.5">
                {items.map((e) => (
                  <div key={e.term} className="text-[11px] leading-snug">
                    <span className="font-bold text-slate-900">{e.term}</span>
                    {e.term !== e.full && (
                      <span className="text-slate-600"> — {e.full}</span>
                    )}
                    <span className="text-slate-700">
                      {" · "}{e.definition}
                    </span>
                    {e.normRef && (
                      <span className="text-[9px] text-slate-400 italic"> [{e.normRef}]</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Подвал */}
        <div className="mt-4 pt-2 border-t border-slate-300 text-[9px] text-slate-500 text-center">
          aevion.kz · /smeta-trainer/glossary · {new Date().toLocaleDateString("ru-RU")}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: white; }
          section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
