/**
 * На /verify/<cert> английские фразы не прячутся в шаблонных строках.
 *
 * ПОВОД (20.10.2026, Продажи → Оркестратор): при ru на записи с подтверждённым
 * блоком бейдж якоря был «✓ CONFIRMED @ BLOCK #…», тогда как «ждёт» и «не
 * удалось» рядом переведены. Строка была `шаблоном` прямо в разметке, а сторож
 * голых подписей (verifyPageSpeaksVisitorLanguage) смотрит текстовые узлы JSX
 * и шаблоны не видит. Тем же путём жили «Bitcoin confirmed at block #…!» и
 * отказ кнопки «проверить сейчас».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VERIFY_DICT } from "../[id]/verifyI18n";

const PAGE = readFileSync(join(__dirname, "../[id]/page.tsx"), "utf8");

/** Шаблонные строки, где после выкидывания ${…} осталась английская фраза (≥2 слов). */
function englishTemplates(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/`([^`]*)`/g)) {
    const text = m[1].replace(/\$\{[^}]*\}/g, " ");
    if (/https?:|\/api\/|px|rgba|gradient|solid/.test(text)) continue;
    // «CONFIRMED @ BLOCK»: знак между словами стоит отдельно — его тоже пропускаем
    if (/\b[A-Za-z]{2,}\s+(?:[@&#-]\s+)?[A-Za-z]{2,}/.test(text)) out.push(m[0].slice(0, 80));
  }
  return out;
}

describe("/verify: шаблонные строки идут через словарь", () => {
  it("КОНТРОЛЬ: детектор видит английский шаблон, когда он есть", () => {
    expect(englishTemplates("x = `✓ CONFIRMED @ BLOCK #${h}`; y = `${tv(lang, \"a b\")} #${h}`")).toEqual([
      "`✓ CONFIRMED @ BLOCK #${h}`",
    ]);
  });

  it("в page.tsx нет английских шаблонных фраз", () => {
    expect(englishTemplates(PAGE)).toEqual([]);
  });

  it("статус якоря и ответы «проверить сейчас» переведены на ru и kk", () => {
    for (const k of [
      "✓ CONFIRMED @ BLOCK",
      "Bitcoin confirmed at block",
      "Still pending Bitcoin confirmation — try later.",
      "Upgrade request failed — try again in a moment.",
    ]) {
      expect(PAGE, `ключ «${k}» не зовётся через tv`).toContain(`tv(lang, "${k}")`);
      for (const lang of ["ru", "kk"] as const) {
        const v = VERIFY_DICT[lang]?.[k];
        expect(v && v !== k, `${lang}: нет перевода «${k}»`).toBe(true);
      }
    }
  });
});
