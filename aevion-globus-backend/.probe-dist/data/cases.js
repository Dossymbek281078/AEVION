"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASE_STUDIES = void 0;
exports.getCaseStudy = getCaseStudy;
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
exports.CASE_STUDIES = [];
function getCaseStudy(id) {
    return exports.CASE_STUDIES.find((c) => c.id === id) ?? null;
}
