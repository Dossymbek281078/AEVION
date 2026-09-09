import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { tDevhub } from "../i18n";

/**
 * Денежная плашка говорит на языке интерфейса.
 *
 * Замер 09.09.2026. Плашка кассы поднимается при денежном отказе: текст отказа
 * приходит с сервера и проходит через границу показа (`devhubServerError`),
 * то есть у EN-визитёра он АНГЛИЙСКИЙ. А кнопка покупки и ссылка под ней были
 * записаны русскими литералами прямо в JSX — «Оформить Pro — $149/мес» и
 * «Уже оплатили?». В момент, когда человек готов заплатить, он видел плашку на
 * двух языках сразу, и по-русски была именно кнопка.
 *
 * Почему это не ловил никто. Сторож `workspaceSpeaksOneLanguage` следит за
 * ОДНОРОДНОСТЬЮ окна, но его охват — аргументы `showToast|setError|…`. Текст
 * внутри JSX в этот охват не входит вовсе: это тот самый класс «сторож видел
 * только один вид текста». Машинный доводчик тоже не защита — соседний замер
 * 06.09 показал, что переводить он не успевает, а здесь речь о самой ценной
 * строке продукта.
 *
 * Починка — не новые литералы, а СЛОВАРЬ МОДУЛЯ: те же три ключа уже
 * обслуживают витрину `/devhub`, и второй их источник однажды разошёлся бы с
 * первым (разная цена или разное обещание на двух экранах).
 */

const KEYS = ["pro.upgrade", "pro.perMonth", "pro.linkPurchase"] as const;

function hasCyrillic(s: string): boolean {
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0x400 && c <= 0x4ff) return true;
  }
  return false;
}

/** Исходник без комментариев: они по-русски, и это нормально. */
function stripComments(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; ) {
    if (raw.startsWith("/*", i)) { const j = raw.indexOf("*/", i + 2); i = j < 0 ? raw.length : j + 2; out += " "; continue; }
    if (raw.startsWith("//", i)) { const j = raw.indexOf("\n", i); i = j < 0 ? raw.length : j; continue; }
    out += raw[i]; i += 1;
  }
  return out;
}

/** Разметка плашки: от условия отрисовки до закрывающей её скобки. */
function panelMarkup(): string {
  const raw = fs.readFileSync(path.join(__dirname, "..", "[id]", "page.tsx"), "utf8");
  const start = raw.indexOf("{upgradeNudge && (");
  expect(start, "не нашёл разметку денежной плашки — сторож ослеп, а не позеленел").toBeGreaterThan(0);
  const end = raw.indexOf("setUpgradeNudge(null)", start);
  expect(end, "не нашёл конец плашки").toBeGreaterThan(start);
  return stripComments(raw.slice(start, end));
}

describe("денежная плашка говорит на языке интерфейса", () => {
  test("в разметке плашки нет русских литералов", () => {
    const m = panelMarkup();
    const bad = m
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => hasCyrillic(l));
    expect(bad, "русский текст в JSX денежной плашки — EN-покупатель увидит его как есть").toEqual([]);
  });

  test("подписи берутся из словаря модуля, а не из своих литералов", () => {
    const m = panelMarkup();
    for (const k of KEYS) {
      expect(m, `плашка обязана звать словарь по ключу ${k}`).toContain(`tPro("${k}")`);
    }
  });

  test("цена подставляется из каталога, а не зашита числом", () => {
    const m = panelMarkup();
    expect(m).toContain("STUDIO_PRO.priceUsd");
  });

  test("все три ключа переведены на три языка", () => {
    for (const k of KEYS) {
      const ru = tDevhub("ru", k);
      const en = tDevhub("en", k);
      const kk = tDevhub("kk", k);
      for (const [lang, v] of [["ru", ru], ["en", en], ["kk", kk]] as const) {
        expect(v.trim().length, `${k} на ${lang} пуст`).toBeGreaterThan(0);
      }
      // Отрицательный контроль в обе стороны: русский обязан быть русским,
      // английский — обязан НЕ быть русским. Без второй половины ключ,
      // забытый в EN-словаре и потому отданный русским запасом, прошёл бы.
      expect(hasCyrillic(ru), `${k}: русский вариант не русский`).toBe(true);
      expect(hasCyrillic(en), `${k}: английский вариант содержит кириллицу`).toBe(false);
    }
  });
});
