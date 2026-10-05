import { readFileSync } from "fs";
import { join } from "path";

/**
 * Помощник для проверок перевода — и причина, по которой он существует.
 *
 * 🔴 `tFor(locale, key)` НЕ ГОДИТСЯ для вопроса «есть ли перевод»:
 *     DICTIONARY[locale]?.[key] ?? DICTIONARY.ru[key] ?? key
 * При пропущенном ключе он отдаёт РУССКОЕ значение, а не ключ. Значит проверка
 * вида `expect(tFor("kk", key)).not.toBe(key)` зелена и тогда, когда казахского
 * перевода нет вовсе: она подтверждает лишь то, что строка есть по-русски.
 *
 * Поймано 05.10.2026 мутацией: переименовал ключ в казахском словаре — проверка
 * прошла. Отсюда правило: наличие перевода спрашиваем у САМОГО словаря.
 */

const ПУТЬ = () => join(process.cwd(), "src/app/cyberchess/i18n.ts");

/** Тело словаря одного языка из i18n.ts. Пусто — значит словаря нет, и это дефект. */
export function blokSlovarya(код: string): string {
  const src = readFileSync(ПУТЬ(), "utf8");
  // Перевод строки собираем кодом символа: обратный слэш съедается на границе
  // вызова оболочки, и "\n" в исходнике уже превращался в настоящий перенос.
  const метка = String.fromCharCode(10) + "  " + код + ": {";
  const i = src.indexOf(метка);
  if (i < 0) return "";
  let глубина = 0;
  let j = i + метка.length - 1;
  for (; j < src.length; j++) {
    if (src[j] === "{") глубина++;
    else if (src[j] === "}") {
      глубина--;
      if (глубина === 0) break;
    }
  }
  return src.slice(i, j);
}

/** Лежит ли ключ ИМЕННО в словаре этого языка (а не достаётся откатом на русский). */
export function klyuchEstVYazyke(код: string, ключ: string): boolean {
  return blokSlovarya(код).includes(`"${ключ}":`);
}

/** Значение ключа в словаре КОНКРЕТНОГО языка, без отката. null — ключа нет. */
export function znachenieVYazyke(код: string, ключ: string): string | null {
  const блок = blokSlovarya(код);
  const m = блок.match(new RegExp(`"${ключ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*"([^"]*)"`));
  return m ? m[1] : null;
}
