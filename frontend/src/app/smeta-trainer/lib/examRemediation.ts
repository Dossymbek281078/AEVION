/**
 * «Работа над ошибками» — автоген плана исправлений из отчёта экзамена.
 *
 * Грейдер (examGrader) уже знает, ЧТО не сошлось: пропущенные/лишние позиции,
 * неверные объёмы, AI-замечания, расхождение итога. Этот модуль превращает разбор
 * в приоритизированный список конкретных действий для студента — без React и
 * сайд-эффектов (легко тестируется, см. examRemediation.test.ts).
 */

import type { ExamReport } from "./examGrader";

export type RemKind = "missing" | "volume" | "extra" | "advice" | "total";
export type RemSeverity = "high" | "medium" | "low";

export interface RemediationItem {
  kind: RemKind;
  severity: RemSeverity;
  /** короткий заголовок проблемы */
  title: string;
  /** императив: что именно сделать */
  action: string;
  /** числа/контекст (объёмы, дельты) */
  detail?: string;
  /** ссылка на норматив, если есть */
  reference?: string;
  rateCode?: string;
}

export interface RemediationPlan {
  items: RemediationItem[];
  counts: Record<RemKind, number>;
  bySeverity: Record<RemSeverity, number>;
  /** сколько баллов потенциально можно добрать до 100 */
  estimatedGain: number;
  /** человекочитаемая сводка для журнала и панели */
  summary: string;
}

const SEV_RANK: Record<RemSeverity, number> = { high: 0, medium: 1, low: 2 };
const KIND_RANK: Record<RemKind, number> = {
  missing: 0, total: 1, volume: 2, extra: 3, advice: 4,
};

function volumeSeverity(deltaPct: number): RemSeverity {
  const a = Math.abs(deltaPct);
  if (a > 15) return "high";
  if (a > 5) return "medium";
  return "low";
}

export interface RemediationOptions {
  /** типовая ловушка из разбора урока — добавляется подсказкой при ошибках */
  trap?: string;
  /** не считать «работу над ошибками» при высоком балле (по умолчанию ≥85 — пусто) */
  cleanThreshold?: number;
}

/**
 * Строит план исправлений из отчёта экзамена. При отличном результате
 * (score ≥ cleanThreshold и нет проблемных позиций) возвращает пустой план.
 */
export function buildRemediation(
  report: ExamReport,
  opts: RemediationOptions = {},
): RemediationPlan {
  const { trap, cleanThreshold = 85 } = opts;
  const items: RemediationItem[] = [];

  for (const p of report.positions) {
    if (p.status === "missing") {
      items.push({
        kind: "missing",
        severity: "high",
        title: `Пропущена позиция ${p.rateCode}`,
        action: `Добавьте «${p.rateTitle}» в смету.`,
        detail: `Эталонный объём — ${p.refVolume} ${p.unit}.`,
        rateCode: p.rateCode,
      });
    } else if (p.status === "off-volume" && p.deltaPct != null) {
      const dir = p.deltaPct > 0 ? "завышен" : "занижен";
      items.push({
        kind: "volume",
        severity: volumeSeverity(p.deltaPct),
        title: `Объём ${dir}: ${p.rateCode}`,
        action: `Исправьте объём «${p.rateTitle}» на эталонный.`,
        detail: `У вас ${p.studentVolume} ${p.unit}, эталон ${p.refVolume} ${p.unit} (Δ ${p.deltaPct > 0 ? "+" : ""}${p.deltaPct.toFixed(1)}%).`,
        rateCode: p.rateCode,
      });
    } else if (p.status === "extra") {
      items.push({
        kind: "extra",
        severity: "medium",
        title: `Лишняя позиция ${p.rateCode}`,
        action: `Удалите «${p.rateTitle}» — её нет в эталонной ЛСР.`,
        detail: p.studentVolume != null ? `Указан объём ${p.studentVolume} ${p.unit}.` : undefined,
        rateCode: p.rateCode,
      });
    }
  }

  // AI-замечания → действия
  for (const n of report.breakdown.ai.notices) {
    const severity: RemSeverity =
      n.severity === "error" ? "high" : n.severity === "warning" ? "medium" : "low";
    items.push({
      kind: "advice",
      severity,
      title: n.title,
      action: n.suggestion ?? n.message,
      detail: n.suggestion ? n.message : undefined,
      reference: n.reference,
    });
  }

  // Расхождение итоговой суммы
  const td = report.breakdown.total.deltaPct;
  if (Math.abs(td) > 5) {
    items.push({
      kind: "total",
      severity: Math.abs(td) > 15 ? "high" : "medium",
      title: "Итоговая сумма расходится с эталоном",
      action:
        td > 0
          ? "Смета завышена — проверьте объёмы и состав позиций."
          : "Смета занижена — вероятно, пропущены работы или объёмы.",
      detail: `Ваш итог ${report.studentTotal.toFixed(0)} ₸, эталон ${report.refTotal.toFixed(0)} ₸ (Δ ${td > 0 ? "+" : ""}${td.toFixed(1)}%).`,
    });
  }

  // Подсказка по типовой ловушке урока — только если есть что исправлять
  if (trap && items.length > 0) {
    items.push({
      kind: "advice",
      severity: "low",
      title: "Перечитайте разбор урока",
      action: trap,
    });
  }

  items.sort(
    (a, b) =>
      SEV_RANK[a.severity] - SEV_RANK[b.severity] || KIND_RANK[a.kind] - KIND_RANK[b.kind],
  );

  const counts: Record<RemKind, number> = { missing: 0, volume: 0, extra: 0, advice: 0, total: 0 };
  const bySeverity: Record<RemSeverity, number> = { high: 0, medium: 0, low: 0 };
  for (const it of items) {
    counts[it.kind] += 1;
    bySeverity[it.severity] += 1;
  }

  // Отличный результат без проблемных позиций → план не нужен
  const hasHardErrors = counts.missing + counts.volume + counts.extra + counts.total > 0;
  const plan: RemediationPlan = {
    items: report.score >= cleanThreshold && !hasHardErrors ? [] : items,
    counts,
    bySeverity,
    estimatedGain: Math.max(0, 100 - report.score),
    summary: "",
  };
  plan.summary = summarize(plan);
  return plan;
}

function summarize(plan: RemediationPlan): string {
  if (plan.items.length === 0) return "Ошибок нет — смета собрана верно.";
  const parts: string[] = [];
  if (plan.bySeverity.high > 0) parts.push(`${plan.bySeverity.high} критич.`);
  if (plan.bySeverity.medium > 0) parts.push(`${plan.bySeverity.medium} на внимание`);
  if (plan.bySeverity.low > 0) parts.push(`${plan.bySeverity.low} мелких`);
  return `${plan.items.length} замечаний (${parts.join(", ")}); потенциал +${plan.estimatedGain} баллов.`;
}
