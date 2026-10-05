import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { SUPPORTED_LOCALES, tFor } from "../i18n";
import { klyuchEstVYazyke } from "./_slovar";

/**
 * Уведомление о лицензии движка существует и НЕ ВРЁТ.
 *
 * Повод (05.10.2026, находка окна «Среды»). Сборки Stockfish лежат в public/ и
 * раздаются всем: aevion.app/stockfish-18-lite-single.js отвечает 200. Это
 * GPLv3, а уведомления не было ни одного — ни файла с текстом лицензии, ни
 * слова «GPL» на странице. GPLv3 требует назвать лицензию И дать доступ к
 * исходникам ИМЕННО той сборки, которую раздаёшь.
 *
 * Главный риск не в том, что строку забудут написать, — её написали. Риск в
 * том, что движок однажды обновят, а строка останется прежней: она назовёт
 * релиз, которого в файлах больше нет, и станет ложной молча. Поэтому сторож
 * сверяет ХЕШ файла на диске с записанным, а не только наличие слов.
 *
 * Регулярок в файле намеренно немного: слэши теряются на границе вызова.
 */

const PUBLIC = join(process.cwd(), "public");
const ИГРОВОЙ = "stockfish-18-lite-single.js";
const РЕЛИЗ = "v18.0.0";
const ССЫЛКА = "https://github.com/nmrugg/stockfish.js/releases/tag/" + РЕЛИЗ;

const читать = (имя: string) => readFileSync(join(PUBLIC, имя), "utf-8");
const страница = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf-8");

describe("лицензия движка названа и подтверждается файлами", () => {
  it("текст лицензии лежит рядом с движком и это настоящий GPLv3", () => {
    const путь = join(PUBLIC, "stockfish-COPYING");
    expect(existsSync(путь), "public/stockfish-COPYING не существует — ссылка в подвале ведёт в 404").toBe(true);
    const текст = читать("stockfish-COPYING");
    // Не заглушка: полный текст GPLv3 — это десятки килобайт и свои разделы.
    expect(текст.length, `размер файла лицензии: ${текст.length} байт`).toBeGreaterThan(30000);
    expect(текст).toContain("GNU GENERAL PUBLIC LICENSE");
    expect(текст).toContain("Version 3, 29 June 2007");
    expect(текст).toContain("TERMS AND CONDITIONS");
    // И он обязан называть ИМЕННО наш релиз, а не лицензию вообще.
    expect(текст, "в тексте лицензии нет ссылки на исходники нашей сборки").toContain(ССЫЛКА);
  });

  it("🔴 хеш раздаваемого движка совпадает с записанным — иначе строка устарела", () => {
    // Ради этого сторож и написан: подмена движка без правки уведомления
    // превращает верную строку в ложную, и заметить это иначе нечем.
    const файл = join(PUBLIC, ИГРОВОЙ);
    expect(existsSync(файл), `${ИГРОВОЙ} пропал из public/`).toBe(true);
    const фактический = createHash("sha256").update(readFileSync(файл)).digest("hex");

    const опись = читать("stockfish-ORIGIN.txt");
    expect(опись, "в описи нет строки про игровую сборку").toContain(ИГРОВОЙ);
    expect(
      опись,
      `движок на диске имеет sha256 ${фактический}, а в public/stockfish-ORIGIN.txt такого хеша нет — ` +
        `либо движок обновили и забыли про уведомление, либо опись устарела`
    ).toContain(фактический);
  });

  it("релиз назван одинаково во всех трёх местах", () => {
    // Подпись, опись и текст лицензии — три разных файла. Разойдутся молча.
    const места: Array<[string, string]> = [
      ["подвал страницы", страница()],
      ["public/stockfish-COPYING", читать("stockfish-COPYING")],
      ["public/stockfish-ORIGIN.txt", читать("stockfish-ORIGIN.txt")],
    ];
    const безРелиза = места.filter(([, т]) => !т.includes(РЕЛИЗ)).map(([имя]) => имя);
    expect(безРелиза, `проверено мест: ${места.length}; релиз ${РЕЛИЗ} не назван в: ${безРелиза.join(", ")}`).toEqual([]);

    // Ссылка на странице должна вести на ТОТ ЖЕ релиз, что в лицензии.
    expect(страница(), "в подвале нет ссылки на исходники сборки").toContain(ССЫЛКА);
  });

  it("строка подвала есть на каждом языке и называет лицензию", () => {
    const пропуски: string[] = [];
    let проверено = 0;
    for (const { code } of SUPPORTED_LOCALES) {
      проверено++;
      // Наличие — у самого словаря: tFor при пропуске откатится на русский.
      if (!klyuchEstVYazyke(code, "engine.license")) { пропуски.push(`${code}/engine.license`); continue; }
      if (!klyuchEstVYazyke(code, "engine.license.copy")) { пропуски.push(`${code}/engine.license.copy`); continue; }
      const текст = tFor(code, "engine.license");
      // Название лицензии — не перевод, оно одинаково на всех языках.
      if (!текст.includes("GPLv3")) пропуски.push(`${code}: в строке не названа лицензия — «${текст}»`);
    }
    expect(пропуски, `проверено языков: ${проверено}; беда с: ${пропуски.join(", ")}`).toEqual([]);
  });

  it("страница действительно выводит строку, а не только держит ключ", () => {
    const s = страница();
    expect(s, "ключ engine.license не выводится на странице").toContain('cc.t("engine.license")');
    expect(s, "ссылка на текст лицензии не выводится").toContain("/stockfish-COPYING");
  });

  it("контроль прибора: сам файл движка на месте и не пуст", () => {
    // Иначе все проверки выше могли бы пройти на отсутствующем движке.
    const размер = statSync(join(PUBLIC, ИГРОВОЙ)).size;
    expect(размер, `размер ${ИГРОВОЙ}: ${размер} байт`).toBeGreaterThan(1000);
  });
});
