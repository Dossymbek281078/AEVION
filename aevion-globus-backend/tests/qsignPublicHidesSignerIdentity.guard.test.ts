import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";
import { maskIssuerEmail } from "../src/routes/qsignV2";

/**
 * Публичная проверка подписи не выдаёт, КТО и ГДЕ подписывал.
 *
 * 🔴 Замер 08.09.2026 на живом проде: /api/qsign/v2/verify/:id и
 * /api/qsign/v2/:id/public отдавали почту подписанта, его userId и координаты
 * подписания — широту и долготу с шестью знаками после запятой, то есть с
 * точностью до метров. Восемь живых подписей, четыре посторонних человека.
 * Идентификаторы подписей мы печатаем сами в открытых списках, так что
 * перебирать было нечего.
 *
 * Почта говорит «кто», координаты со временем говорят «где он был» — вместе
 * это слежка, а не доказуемость. Подлинность удостоверяет КЛЮЧ.
 *
 * Ни одно из этих полей НЕ входит в подписанное содержимое (подписи считаются
 * по canonicalJson(payload)), поэтому правка не меняет офлайн-проверку и не
 * трогает прежние сертификаты.
 */
const SRC = stripComments(
  readFileSync(join(__dirname, "..", "src", "routes", "qsignV2.ts"), "utf8"),
);
const TYPES = stripComments(
  readFileSync(join(__dirname, "..", "src", "lib", "qsignV2", "types.ts"), "utf8"),
);

/** Тело обработчика: от объявления маршрута до следующего объявления. */
function telo(deklaraciya: string): string {
  const at = SRC.indexOf(deklaraciya);
  if (at < 0) return "";
  const next = SRC.indexOf("qsignV2Router.", at + 10);
  return SRC.slice(at, next < 0 ? SRC.length : next);
}

const PUBLICHNYE = [
  'qsignV2Router.get("/verify/:id"',
  'qsignV2Router.get("/:id/public"',
];

describe("публичная подпись не выдаёт личность и место", () => {
  it("прибор исправен: тела найдены, и там, где личность законна, он её видит", () => {
    for (const d of PUBLICHNYE) {
      expect(telo(d).length, `не найдено тело ${d}`).toBeGreaterThan(300);
    }
    // Положительный контроль: у ОТВЕТА НА ПОДПИСЬ (свои данные подписавшего,
    // за проверкой токена) и userId, и координаты законны — разбор обязан их
    // там находить, иначе «нигде нет» означало бы «не умею читать».
    expect(SRC.includes("issuer: { userId: auth.sub, email: auth.email }")).toBe(true);
    expect(SRC.includes("lat: geo.lat")).toBe(true);
  });

  for (const d of PUBLICHNYE) {
    it(`${d}: ни userId, ни координат в ответе`, () => {
      const t = telo(d);
      expect(t.includes("issuerUserId"), "userId подписанта уходит наружу").toBe(false);
      expect(/lat:\s*row\.geoLat/.test(t), "широта уходит наружу").toBe(false);
      expect(/lng:\s*row\.geoLng/.test(t), "долгота уходит наружу").toBe(false);
      expect(/city:\s*row\.geoCity/.test(t), "город уходит наружу").toBe(false);
    });

    it(`${d}: адрес уходит только маской`, () => {
      const t = telo(d);
      expect(t.includes("maskIssuerEmail(row.issuerEmail)"), "адрес без маски").toBe(true);
      expect(/email:\s*row\.issuerEmail/.test(t), "адрес уходит как есть").toBe(false);
    });
  }

  it("у issuer тип сужен, а координаты отдаются ЯВНЫМ null", () => {
    // Про issuer тип сужен: вернуть userId одной строкой уже не выйдет, tsc
    // не промолчит.
    expect(TYPES.includes("issuer: { email: string | null } | null")).toBe(true);

    // А вот у geo поля city/lat/lng в типе ОСТАВЛЕНЫ намеренно, и это не
    // недоделка. Старая страница проверки читает координаты сравнением
    // `lat !== null`: убери мы ключи совсем, `undefined !== null` дало бы
    // истину и страница упала бы на `.toFixed`. Между посадкой бэкенда и
    // посадкой сайта проходят минуты, и в эти минуты старый клиент читает
    // новый ответ. Поэтому проверяем не отсутствие полей, а то, что в
    // публичных ответах в них стоит ЯВНЫЙ null.
    for (const d of PUBLICHNYE) {
      const t = telo(d);
      expect(/city:\s*null/.test(t), `${d}: город не обнулён явно`).toBe(true);
      expect(/lat:\s*null/.test(t), `${d}: широта не обнулена явно`).toBe(true);
      expect(/lng:\s*null/.test(t), `${d}: долгота не обнулена явно`).toBe(true);
    }
  });

  it("маска оставляет ответ на вопрос «кто», но не публикует адрес", () => {
    const m = maskIssuerEmail("ivan.petrov@example.com");
    expect(m).toBe("i***@e***.com");
    expect(m!.includes("ivan.petrov")).toBe(false);
    expect(m!.includes("example")).toBe(false);
    // Пустое и мусор не должны превращаться в правдоподобную маску.
    expect(maskIssuerEmail(null)).toBeNull();
    expect(maskIssuerEmail("")).toBeNull();
    expect(maskIssuerEmail("@example.com")).toBeNull();
  });
});
