/**
 * Customer case studies — для /pricing/cases.
 * Каждый кейс — короткая GTM-история с конкретными метриками before/after.
 * Все компании анонимизированы или с разрешением; цитаты фиктивные но
 * структурно соответствуют реальным early-customer interviews.
 *
 * Структура:
 *   - id: slug
 *   - customer/industry/tier/modules: контекст
 *   - challenge / solution / outcome: классическая SaaS case-study форма
 *   - metrics: 3-4 численные метрики ROI (before → after)
 *   - quote: цитата + автор + должность
 */

export type CaseIndustry = "banks" | "startups" | "government" | "creators" | "law-firms" | "media";
export type CaseTier = "free" | "lite" | "medium" | "full" | "enterprise";

export interface CaseMetric {
  label: string;
  before: string;
  after: string;
  delta: string;
  /** "positive" | "negative" — для подсветки. */
  direction: "positive" | "negative";
}

export interface CaseStudy {
  id: string;
  customer: string;
  customerInitials: string;
  customerColor: string;
  industry: CaseIndustry;
  region: string;
  tier: CaseTier;
  modules: string[];
  /** 1 строка для карточки в листинге */
  hook: string;
  /** Короткое описание контекста — что было сложно */
  challenge: string;
  /** Какое решение собрали из AEVION */
  solution: string;
  /** Что в итоге получили (ROI-абзац) */
  outcome: string;
  metrics: CaseMetric[];
  quote: { text: string; author: string; role: string };
  /** Дата кейса для сортировки и микроподписи */
  date: string;
}

/**
 * Пусто с 20.09.2026, и это решение об ЧЕСТНОСТИ, а не о дизайне.
 *
 * Здесь лежали шесть «кейсов клиентов» с названиями компаний, метриками ROI и
 * цитатами. Шапка этого же файла признавала: «цитаты фиктивные». Ручка
 * /api/pricing/cases отдавала их публично, страница /pricing/cases показывала
 * как истории клиентов — то есть как доказательство, которого нет.
 *
 * Тексты не потеряны: data/cases.unpublished.ts. Вернуть можно СЦЕНАРИЯМИ —
 * без имён компаний, без цитат, с явной пометкой, что числа расчётные, — это
 * решение основателя. Настоящие кейсы появятся, когда появятся клиенты.
 */
export const CASE_STUDIES: CaseStudy[] = [];

export function getCaseStudy(id: string): CaseStudy | null {
  return CASE_STUDIES.find((c) => c.id === id) ?? null;
}
