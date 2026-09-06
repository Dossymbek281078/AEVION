/**
 * Поиск по справочнику ТОЛЬКО среди своих ключей.
 *
 * ЗАЧЕМ. Прямая индексация `MAP[key]` ключом, пришедшим снаружи (сегмент
 * адреса, параметр запроса, поле записи), разрешает имена из прототипа:
 * `constructor`, `toString`, `__proto__`, `valueOf`. Значение при этом
 * приходит не наше и обычно ИСТИННОЕ, поэтому привычная страховка
 * `?? запасное` не срабатывает — она проверяет пустоту, а пришла функция.
 *
 * ЗАМЕР 04.09.2026, рендером страницы успеха оплаты на `?provider=constructor`:
 *
 *     paid via function Object() { [native code] } · secure
 *     check your email — a receipt from function Object() { [native code] }
 *     manage your subscription — in your function Object() { [native code] }
 *
 * Три раза на одном экране, и это экран сразу после списания денег.
 *
 * ПОЧЕМУ ВОЗВРАЩАЕТ undefined, А НЕ ЗАПАСНОЕ ЗНАЧЕНИЕ. Чтобы вызывающему не
 * пришлось менять привычную запись: `изСправочника(MAP, k) ?? запасное`
 * читается так же, как прежняя строка, и правка сводится к обёртке. Меньше
 * правки — меньше шанс, что при переносе потеряется смысл.
 */
export function изСправочника<T>(
  map: Record<string, T>,
  key: string | null | undefined,
): T | undefined {
  if (!key) return undefined;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

export default изСправочника;
