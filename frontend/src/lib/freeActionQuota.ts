/**
 * Бесплатная норма действий в месяц — копия числа бэкенда для витрины.
 *
 * Источник правды — aevion-globus-backend/src/lib/freeActionQuota.ts,
 * `бесплатноВМесяц(действие)`: своё число из переменной FREE_<ДЕЙСТВИЕ>_PER_MONTH,
 * иначе 3. На проде переменные для bureau_verify и qright_register не заданы —
 * 4-я регистрация отвечает 402 {"error":"free_quota_exceeded","used":4,"freePerMonth":3}
 * (замер 30.10.2026). Снаружи число не отдаётся: ни /health (paywall.paidActions —
 * только список действий и пилотная норма 50), ни /api/paywall/policy (только
 * requiredTiers по модулям) его не называют — проверено curl 30.10.2026. Поэтому
 * здесь константа, а сторож src/lib/__tests__/freeActionQuotaMatchesBackend.guard.test.ts
 * сверяет её с исходником бэкенда в этом же репозитории.
 *
 * 🔴 Повод (30.10.2026): плашка на /bureau и /qright говорила «Входит в подписку
 * AEVION · от $150/мес», а что подписка даёт — ни слова; человек узнавал о пределе
 * «3 в месяц» только из отказа 402 после четвёртой работы.
 */
export const FREE_ACTIONS_PER_MONTH = 3;

/**
 * Модули плашки, у которых подписка снимает именно эту норму (стены у них нет:
 * data/moduleAccess.ts — «доступ ничем не ограничен»). Имена — moduleId плашки,
 * как они стоят в <ModulePricingChip moduleId=…> на страницах /bureau и /qright.
 */
const МОДУЛИ_С_НОРМОЙ: ReadonlySet<string> = new Set(["bureau", "qright"]);

export function moduleHasFreeQuota(moduleId: string): boolean {
  return МОДУЛИ_С_НОРМОЙ.has(moduleId);
}
