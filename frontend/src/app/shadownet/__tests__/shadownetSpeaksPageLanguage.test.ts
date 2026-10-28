import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tShadow, SHADOW_KEYS, SHADOW_DICT, THREATS, COUNTRIES } from "../i18n";

/*
 * 28.10.2026 (окно «Приложения-2»). Страница была смесью en/ru при любом языке сайта:
 * «encrypt + post», «fetch posts (N)», «weakest link: tor», модели угроз — название en, описание ru.
 * Здесь: словарь полон на ru/en/kk, на экране нет текста мимо словаря, и словарь знает все id,
 * страны и ключи, которые отдаёт сервер (routes/shadownet.ts) — иначе показалась бы сырая строка.
 */
const ПАПКА = join(process.cwd(), "src/app/shadownet");
const ФАЙЛЫ = ["page.tsx", ...["EncryptedPostForm", "PostReader", "PrivacyScore", "RoutingSimulator", "StatsStrip", "ThreatModelSelector"].map((к) => `components/${к}.tsx`)];
const СЕРВЕР = readFileSync(join(process.cwd(), "..", "aevion-globus-backend", "src", "routes", "shadownet.ts"), "utf8");
const кириллица = /[А-Яа-яЁё]/;

describe("ShadowNet: ru/en/kk", () => {
  test("у трёх языков все ключи непустые; en без кириллицы; kk не копия ru", () => {
    for (const lang of ["ru", "en", "kk"]) for (const k of SHADOW_KEYS) expect(SHADOW_DICT[lang]![k].trim(), `${lang}:${k}`).not.toBe("");
    expect(SHADOW_KEYS.filter((k) => кириллица.test(SHADOW_DICT.en![k]))).toEqual([]);
    const копии = SHADOW_KEYS.filter((k) => SHADOW_DICT.kk![k] === SHADOW_DICT.ru![k] && кириллица.test(SHADOW_DICT.ru![k]));
    expect(копии).toEqual(["page.badge", "route.ms"]); // «симулятор», «мс» — общие слова
  });

  test("подстановки", () => {
    expect(tShadow("ru", "route.hops", { n: 5 })).toBe("узлов: 5");
    expect(tShadow("en", "reader.confirmDelete", { id: 7 })).toBe("Delete note #7?");
    expect(tShadow("de", "form.submit")).toBe("Encrypt & post"); // язык без словаря → en, не ru
  });

  test("словарь знает каждую модель угроз, страну и слой, которые отдаёт сервер", () => {
    const ids = [...СЕРВЕР.matchAll(/^\s{4}id: "([a-z]+)",$/gm)].map((m) => m[1]);
    expect(ids.length).toBe(4);
    for (const lang of ["ru", "en", "kk"]) for (const id of ids) {
      const м = THREATS[lang]![id]!;
      expect(м, `${lang}:${id}`).toBeDefined();
      expect(м.protectsFrom.length + м.recommendations.length).toBeGreaterThan(5);
      if (lang === "en") expect(JSON.stringify(м)).not.toMatch(кириллица);
    }
    const страны = СЕРВЕР.slice(СЕРВЕР.indexOf("const HOP_COUNTRIES"), СЕРВЕР.indexOf("];", СЕРВЕР.indexOf("const HOP_COUNTRIES")));
    const имена = [...страны.matchAll(/"([A-Za-z ]+)"/g)].map((m) => m[1]!);
    expect(имена.length).toBe(12);
    for (const lang of ["ru", "kk"]) for (const и of имена) expect(COUNTRIES[lang]![и], `${lang}:${и}`).toMatch(кириллица);
    for (const k of ["tor", "vpn", "dns", "browser", "e2e"]) {
      expect(СЕРВЕР).toContain(`  ${k}: `);
      expect(SHADOW_KEYS).toContain(`advice.${k}`);
    }
  });

  test("🔴 на экране нет текста мимо словаря (JSX-текст, placeholder, aria-label, title, label)", () => {
    for (const ф of ФАЙЛЫ) {
      const s = readFileSync(join(ПАПКА, ф), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
      const плохие = s.split("\n").filter((l) =>
        />\s*[A-Za-zА-Яа-яЁё][^<{}]*</.test(l) && !/>\s*(ShadowNet|← AEVION)\s*</.test(l) ||
        /(placeholder|aria-label|title|label|sectionTitle|sectionHint)[=:]\s*"[^"]*[A-Za-zА-Яа-яЁё]{3}/.test(l) && !/label: "(VeilNetX|Quantum Shield|QSign)"|placeholder: "anon"/.test(l) ||
        /^\s+[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё ,.—-]{6,}$/.test(l),
      );
      expect(плохие, ф).toEqual([]);
    }
  });

  test("сырые ответы сервера и исключения не выводятся человеку", () => {
    for (const ф of ФАЙЛЫ) {
      const s = readFileSync(join(ПАПКА, ф), "utf8");
      expect(s, ф).not.toMatch(/j\?\.error \|\||String\(e\)|e\.message|\{result\.weakest\}|\{n\.country\}|\{m\.threatLevel\}/);
    }
  });
});
