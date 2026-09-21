/**
 * Наши собственные пробы в публичных лентах Planet (§19 CLAUDE.md).
 *
 * Замер 14–20.09.2026: смоук-скрипты и прямые `curl -X POST` оставляют на проде
 * записи вида `smoke-...`, и посетитель видит их в ленте рядом с настоящими
 * работами. 20.09 я спрятал их НА СТРАНИЦЕ — и сторож витрин справедливо остался
 * красным: он спрашивает API, а данные никуда не делись. Значит прятать надо
 * там, где данные отдаются, иначе следующая страница покажет их снова.
 *
 * ГРАНИЦА ПРАВИЛА, и она важнее самого правила. «Начинается на smoke» — слишком
 * жадно: работа с названием «Smokehouse chef» — настоящая, и скрыть её было бы
 * хуже, чем показать пробу (на этом я поймал себя в тот же день на витрине
 * историй найма). Поэтому требуется РАЗДЕЛИТЕЛЬ после слова: `smoke-`, `probe `,
 * `test:` — да; `smokehouse`, `testament`, `probable` — нет.
 *
 * Скрытое не исчезает бесшумно: ручки печатают `probesHidden` — сколько записей
 * спрятано. Оговорка в комментарии не заменяет поле в данных.
 */
const СЛОВА = ["smoke", "probe", "test"];

/** Слово-проба целиком или слово + разделитель: `smoke-1`, `probe idea`, `test:2`. */
function словоПробы(значение: string): boolean {
  const v = значение.trim().toLowerCase();
  for (const w of СЛОВА) {
    if (v === w) return true;
    if (v.startsWith(w) && /^[-_ :.\/]/.test(v.slice(w.length))) return true;
  }
  return false;
}

/** Технический ключ прогона: `k1758300000000`, `k-1758300000000`. */
function ключПрогона(значение: string): boolean {
  return /^k-?[0-9]{13}$/.test(значение.trim().toLowerCase());
}

export function похожеНаПробу(строка: { title?: string | null; ref?: string | null }): boolean {
  const title = String(строка.title ?? "");
  const ref = String(строка.ref ?? "");
  if (словоПробы(title) || словоПробы(ref)) return true;
  if (ref.trim().toLowerCase().endsWith("-test")) return true;
  return ключПрогона(title) || ключПрогона(ref);
}

/** Делит список на видимое посетителю и счёт скрытого. */
export function безПроб<T extends { title?: string | null; ref?: string | null }>(
  строки: T[],
  показыватьПробы: boolean,
): { видимые: T[]; скрыто: number } {
  if (показыватьПробы) return { видимые: строки, скрыто: 0 };
  const видимые = строки.filter((s) => !похожеНаПробу(s));
  return { видимые, скрыто: строки.length - видимые.length };
}

/** `?includeProbes=1` — для наших проверок; посетителю пробы не отдаются. */
export function просятПробы(q: unknown): boolean {
  const v = (q as Record<string, unknown> | undefined)?.includeProbes;
  return v === "1" || v === "true";
}
