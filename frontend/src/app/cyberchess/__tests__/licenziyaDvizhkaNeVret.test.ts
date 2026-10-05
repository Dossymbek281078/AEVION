import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { SUPPORTED_LOCALES, tFor } from "../i18n";
import { klyuchEstVYazyke } from "./_slovar";

/**
 * Уведомление о лицензиях движков существует и НЕ ВРЁТ.
 *
 * Повод (05.10.2026). Сборки движка лежат в public/ и раздаются всем, а
 * уведомления не было ни одного: ни текста лицензии, ни слова «GPL» на
 * странице. Лицензии требуют назвать условия И дать доступ к исходникам
 * ИМЕННО той сборки, которую раздаёшь.
 *
 * Сборок оказалось ЧЕТЫРЕ и из ДВУХ разных проектов с разными лицензиями —
 * это выяснилось не сразу: два окна искали загрузчик по исходникам и оба
 * решили, что аналитический движок мёртв. Он грузится из public/
 * (deep-engine-worker.js), куда никто не смотрел.
 *
 * Главный риск теперь не «забыли написать», а «движок обновили, а текст
 * остался». Поэтому сторож сверяет ХЕШИ файлов на диске с описью, а не
 * наличие слов.
 */

const PUBLIC = join(process.cwd(), "public");
const ОПИСЬ = "stockfish-ORIGIN.txt";
const ЛИЦЕНЗИЯ_GPL = "stockfish-COPYING";
const ЛИЦЕНЗИЯ_AGPL = "deep-engine-AGPL";

const читать = (имя: string) => readFileSync(join(PUBLIC, имя), "utf-8");
const страница = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf-8");

/** Все файлы движка, которые сайт раздаёт. Список берётся с ДИСКА, не из памяти. */
function fayliDvizhka(): string[] {
  return readdirSync(PUBLIC)
    .filter((f) => (f.startsWith("stockfish-") || f.startsWith("sf171-")) && (f.endsWith(".js") || f.endsWith(".wasm")))
    .sort();
}

describe("лицензии движков названы и подтверждаются файлами", () => {
  it("тексты лицензий лежат рядом с движками и они настоящие", () => {
    for (const [имя, заголовок] of [
      [ЛИЦЕНЗИЯ_GPL, "GNU GENERAL PUBLIC LICENSE"],
      [ЛИЦЕНЗИЯ_AGPL, "GNU AFFERO GENERAL PUBLIC LICENSE"],
    ] as const) {
      expect(existsSync(join(PUBLIC, имя)), `public/${имя} не существует — ссылка повела бы в 404`).toBe(true);
      const текст = читать(имя);
      expect(текст.length, `${имя}: ${текст.length} байт — для полного текста лицензии слишком мало`).toBeGreaterThan(30000);
      expect(текст, `${имя}: это не тот текст лицензии`).toContain(заголовок);
      expect(текст).toContain("TERMS AND CONDITIONS");
    }
    // Контроль прибора: AGPL отличается от GPL разделом о сетевом использовании.
    expect(читать(ЛИЦЕНЗИЯ_AGPL)).toContain("Remote Network Interaction");
  });

  it("🔴 каждая раздаваемая сборка описана, и её хеш совпадает с файлом", () => {
    // Ради этого сторож и написан: подмена движка без правки уведомления
    // превращает верный текст в ложный, и заметить это иначе нечем.
    const опись = читать(ОПИСЬ);
    const файлы = fayliDvizhka();

    // Знаменатель: если файлов вдруг стало мало, сторож ослеп, а не стало чисто.
    expect(файлы.length, `сборок движка в public/: ${файлы.length}`).toBeGreaterThanOrEqual(6);

    const беда: string[] = [];
    for (const f of файлы) {
      const факт = createHash("sha256").update(readFileSync(join(PUBLIC, f))).digest("hex");
      if (!опись.includes(f)) { беда.push(`${f}: нет в описи`); continue; }
      if (!опись.includes(факт)) беда.push(`${f}: на диске sha256 ${факт}, в описи такого нет`);
    }
    expect(
      беда,
      `проверено сборок: ${файлы.length}; расхождения: ${беда.join(" | ")}`
    ).toEqual([]);
  });

  it("оба проекта названы, и для каждого дана ссылка на исходники", () => {
    const лиц = читать(ЛИЦЕНЗИЯ_GPL);
    const опись = читать(ОПИСЬ);
    for (const источник of [
      "https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0",
      "lila-stockfish-web",
    ]) {
      expect(лиц, `в тексте лицензий не названо: ${источник}`).toContain(источник);
      expect(опись, `в описи не названо: ${источник}`).toContain(источник);
    }
    // Расхождение лицензий у источника названо, а не замолчано.
    expect(лиц, "не названо расхождение AGPL/GPL у lila-stockfish-web").toContain("AGPL");
  });

  it("подпись в подвале не называет версию — движков два", () => {
    // Любая ОДНА версия в подписи неверна для второго движка и устареет при
    // первом обновлении. Версии живут в описи, подпись ведёт к ней ссылкой.
    const s = страница();
    expect(s, "ссылка на тексты лицензий пропала из подвала").toContain("/stockfish-COPYING");
    expect(s, "ключ подписи не выводится").toContain('cc.t("engine.license")');
    for (const { code } of SUPPORTED_LOCALES) {
      const текст = tFor(code, "engine.license");
      expect(текст, `${code}: подпись называет версию — она разойдётся с файлами`).not.toContain("v18.0.0");
      expect(текст, `${code}: подпись не называет оба движка`).toContain("Stockfish.js");
    }
  });

  it("подпись есть на каждом языке", () => {
    const пропуски: string[] = [];
    let проверено = 0;
    for (const { code } of SUPPORTED_LOCALES) {
      проверено++;
      for (const k of ["engine.license", "engine.license.copy"]) {
        if (!klyuchEstVYazyke(code, k)) пропуски.push(`${code}/${k}`);
      }
    }
    expect(пропуски, `проверено языков: ${проверено}; без перевода: ${пропуски.join(", ")}`).toEqual([]);
  });
});
