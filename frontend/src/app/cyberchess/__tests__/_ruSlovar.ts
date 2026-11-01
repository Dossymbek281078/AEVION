// Общий читатель словаря для сторожей исходника: русские строки живут в словарях
// (i18n.ts и задачный p/pzSlova.ts, ключи pz.*), а в page.tsx стоит вызов ключа.
// Сторож проверяет ОБА конца: ключ вызван в нужном месте и ru-значение несёт прежний смысл.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const i18n = readFileSync(join(__dirname, "..", "i18n.ts"), "utf8");
const pzSlova = readFileSync(join(__dirname, "..", "p", "pzSlova.ts"), "utf8");
function chast(src: string, ot: string, do_: string): Record<string, string> {
  const a = src.indexOf(ot), b = src.indexOf(do_);
  const out: Record<string, string> = {};
  for (const m of src.slice(a, b).matchAll(/^\s+"([^"]+)":\s+"((?:[^"\\]|\\.)*)"/gm)) out[m[1]] = m[2];
  return out;
}
export const ru: Record<string, string> = {
  ...chast(i18n, "  ru: {", "  en: {"),
  ...chast(pzSlova, "  ru: {", "  en: {"),
};
/** ru-значение ключа; падает, если ключа в ru-словаре нет. */
export function ruOf(key: string): string {
  const v = ru[key];
  if (v === undefined) throw new Error(`в ru-словаре нет ключа ${key}`);
  return v;
}
