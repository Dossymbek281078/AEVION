/**
 * «Применить исправления» — детерминированное приведение ЛСР студента к эталону
 * по механическим расхождениям из отчёта грейдера.
 *
 * Чинит ТОЛЬКО объёмы, лишние и пропущенные позиции (то, что однозначно следует
 * из эталона). AI-замечания (забытый коэффициент, двойной счёт, неверный индекс)
 * НЕ трогаются — это решает студент сам, иначе тренажёр превращается в автозаполнение.
 *
 * Без React и сайд-эффектов — см. examFix.test.ts.
 */

import type { Lsr, SmetaPosition } from "./types";
import type { ExamReport } from "./examGrader";

export interface FixCounts {
  volume: number; // объёмы приведены к эталону
  removed: number; // удалено лишних
  added: number; // добавлено пропущенных
}

export interface FixResult {
  lsr: Lsr;
  counts: FixCounts;
}

/** Карта эталонных позиций по шифру: объём + коэффициенты (для добавления пропущенных). */
function refByCode(reference: Lsr): Map<string, SmetaPosition> {
  const m = new Map<string, SmetaPosition>();
  for (const s of reference.sections) {
    for (const p of s.positions) {
      if (!m.has(p.rateCode)) m.set(p.rateCode, p);
    }
  }
  return m;
}

/**
 * Возвращает новую ЛСР с исправленными механическими расхождениями.
 * Исходная ЛСР не мутируется (defensive copy на уровне секций/позиций).
 */
export function applyReferenceFixes(
  lsr: Lsr,
  report: ExamReport,
  reference: Lsr,
): FixResult {
  const counts: FixCounts = { volume: 0, removed: 0, added: 0 };

  // целевые объёмы и наборы шифров из отчёта
  const refVolumeByCode = new Map<string, number>();
  const extraCodes = new Set<string>();
  const missingCodes = new Set<string>();
  for (const p of report.positions) {
    if (p.status === "off-volume") refVolumeByCode.set(p.rateCode, p.refVolume);
    else if (p.status === "extra") extraCodes.add(p.rateCode);
    else if (p.status === "missing") missingCodes.add(p.rateCode);
  }

  // 1. объёмы + удаление лишних (по разделам, defensive copy)
  const sections = lsr.sections.map((s) => {
    const positions: SmetaPosition[] = [];
    for (const p of s.positions) {
      if (extraCodes.has(p.rateCode)) {
        counts.removed += 1;
        continue;
      }
      if (refVolumeByCode.has(p.rateCode)) {
        const target = refVolumeByCode.get(p.rateCode)!;
        if (p.volume !== target) counts.volume += 1;
        positions.push({ ...p, volume: target });
      } else {
        positions.push({ ...p });
      }
    }
    return { ...s, positions };
  });

  // 2. добавление пропущенных позиций в первый раздел (грейдер сверяет по всей ЛСР)
  if (missingCodes.size > 0 && sections.length > 0) {
    const refMap = refByCode(reference);
    const target = sections[0];
    const added: SmetaPosition[] = [];
    let seq = 0;
    for (const code of missingCodes) {
      const ref = refMap.get(code);
      if (!ref) continue; // эталон не содержит — пропускаем
      added.push({
        id: `fix-${code}-${seq++}`,
        rateCode: code,
        volume: ref.volume,
        coefficients: (ref.coefficients ?? []).map((c) => ({ ...c })),
        formula: "добавлено: работа над ошибками",
      });
      counts.added += 1;
    }
    sections[0] = { ...target, positions: [...target.positions, ...added] };
  }

  return {
    lsr: { ...lsr, sections },
    counts,
  };
}

/** Есть ли вообще что автоматически чинить. */
export function hasMechanicalFixes(report: ExamReport): boolean {
  return report.positions.some(
    (p) => p.status === "off-volume" || p.status === "extra" || p.status === "missing",
  );
}
