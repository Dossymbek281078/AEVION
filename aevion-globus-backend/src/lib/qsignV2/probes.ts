/*
 * 🔴 19.10.2026: публичные лента (/recent) и счётчики (/stats) QSign не кормятся
 * НАШИМИ пробами.
 *
 * Замер на проде 19.10 (окно Продукт, прибор put-gostya.mjs): один прогон пути
 * гостя поднял «подписей» 51→53 и «издателей» 26→27; витрина «Проверить реальную
 * подпись» стала вести на мою пробу с payload {"probe":"user-99-…"}, а до того —
 * на отозванную пробу. Из 20 записей ленты все 7 действующих были тестовыми
 * ({"probe":…}, {"idem":"test"}). Числа на первом экране — утверждение покупателю,
 * и оно состояло из проб.
 *
 * Правило одно для SQL и для JS, чтобы ручки и сторож спорили об одном и том же:
 *   — издатель с почтой probe-/smoke-/demo- (так подписаны наши учётки проб и
 *     демо-учётка AEVION) — проба;
 *   — почта издателя в домене .test (RFC 2606, зарезервирован для тестов) —
 *     проба: замер прод-базы 19.10 (railway run, только чтение) — все 22 записи,
 *     не пойманные другими правилами, были от qsi…@aevion.test с payload
 *     {"hello":"AEVION",…}; настоящих подписей в базе 0 из 54;
 *   — payload со словом probe/smoke/test/idem как отдельным словом — проба.
 * /verify/:id и /:id/public НЕ фильтруются: прямая ссылка на пробу или демо
 * остаётся живой (закреплённая демо-подпись на витрине — именно так).
 * Строки в базе не трогаем.
 */
export const ПРОБЫ_ПОДПИСЕЙ_SQL =
  `(COALESCE("issuerEmail", '') ~* '^(probe|smoke|demo)[-+._]' ` +
  `OR COALESCE("issuerEmail", '') ~* '@[^@]*\.test$' ` +
  `OR COALESCE("payloadCanonical", '') ~* '\m(probe|smoke|test|idem)\M')`;

/** Та же проверка на строке таблицы QSignSignature (вторая линия в /recent и для сторожа). */
export function этоПробаПодписи(row: { issuerEmail?: unknown; payloadCanonical?: unknown }): boolean {
  const email = String(row.issuerEmail ?? "");
  const payload = String(row.payloadCanonical ?? "");
  return (
    /^(probe|smoke|demo)[-+._]/i.test(email) ||
    /@[^@]*\.test$/i.test(email) ||
    /\b(probe|smoke|test|idem)\b/i.test(payload)
  );
}
