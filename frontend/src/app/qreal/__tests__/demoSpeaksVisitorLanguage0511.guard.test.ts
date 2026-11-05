import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEMO_I18N_DATA as D, DISCLOSURE_RU, anchorText, criterionLabel, demoProjectTitle, demoShotTitle,
  disclosureText, engineLabel, engineNote,
} from "../demoI18n";

// 5.11.2026: на en/kk демо QReal показывал русские строки из API (заголовки, критерии,
// якоря, движки, ИИ-маркировку). Переводим на сайте по id; бэкенд не трогаем.
const КИР = /[А-Яа-яЁё]/;
const back = (p: string) => readFileSync(join(__dirname, "..", "..", "..", "..", "..", "aevion-globus-backend", "src", p), "utf8");
const IDS_CRIT = [...back("routes/qreal.ts").matchAll(/\{ id: "([\w-]+)", label: "/g)].map((m) => m[1]);

describe("демо QReal говорит на языке посетителя", () => {
  test("знаменатель: критериев в бэкенде 14", () => expect(IDS_CRIT.length).toBe(14));
  test("en/kk содержат все id критериев и якорей из бэкенда", () => {
    for (const id of IDS_CRIT) {
      expect(D.CRITERIA[id], id).toBeTruthy();
      expect(D.ANCHORS[id], id).toBeTruthy();
    }
  });
  test("en/kk содержат проект, 4 кадра и 4 движка", () => {
    for (const id of ["demo-steppe-morning", "demo-shot-1", "demo-shot-2", "demo-shot-3", "demo-shot-4"]) expect(D.DEMO_TITLES[id], id).toBeTruthy();
    for (const id of ["seedance", "kling", "elevenlabs", "local-ffmpeg"]) expect(D.ENGINES[id], id).toBeTruthy();
  });
  test("на en нет кириллицы, kk не равен en", () => {
    const все: Array<[string, string, string]> = [];
    for (const v of Object.values(D.DEMO_TITLES)) all(v.en, v.kk);
    for (const v of Object.values(D.CRITERIA)) all(v.en, v.kk);
    for (const v of Object.values(D.ANCHORS)) v.en.forEach((x, i) => all(x, v.kk[i]));
    for (const v of Object.values(D.ENGINES)) { all(v.label.en, v.label.kk); all(v.note.en, v.note.kk); }
    all(D.DISCLOSURE.en, D.DISCLOSURE.kk);
    function all(en: string, kk: string) { все.push([en, kk, ""]); }
    expect(все.length).toBeGreaterThan(60);
    for (const [en, kk] of все) {
      expect(КИР.test(en), en).toBe(false);
      expect(kk, en).not.toBe(en);
    }
  });
  test("ИИ-маркировка на en/kk сохраняет смысл: ИИ, не существуют, EU AI Act art. 50", () => {
    expect(disclosureText("en", DISCLOSURE_RU)).toMatch(/entirely AI-generated.*do not exist.*EU AI Act art\. 50/);
    expect(disclosureText("kk", DISCLOSURE_RU)).toMatch(/толығымен жасанды интеллект.*жоқ.*EU AI Act 50/);
    expect(disclosureText("ru", DISCLOSURE_RU)).toBe(DISCLOSURE_RU);
    expect(disclosureText("en", "чужой текст")).toBe("чужой текст");
  });
  test("неизвестный id и чужой проект отдают значение из API", () => {
    expect(criterionLabel("en", { id: "новый", label: "Новый критерий" })).toBe("Новый критерий");
    expect(anchorText("kk", "новый", "1", "Якорь")).toBe("Якорь");
    expect(engineLabel("en", { id: "x", label: "Движок" })).toBe("Движок");
    expect(engineNote("en", { id: "x", note: "Заметка" })).toBe("Заметка");
    expect(demoProjectTitle("en", { id: "u-1", title: "Утро в степи" })).toBe("Утро в степи");
    expect(demoShotTitle("kk", "u-1", { id: "demo-shot-1", title: "Рассвет над степью" })).toBe("Рассвет над степью");
    expect(demoShotTitle("en", "demo-steppe-morning", { id: "u-9", title: "Мой кадр" })).toBe("Мой кадр");
  });
  test("ru показывает значение из API", () => {
    expect(demoProjectTitle("ru", { id: "demo-steppe-morning", title: "Утро в степи" })).toBe("Утро в степи");
    expect(criterionLabel("ru", { id: "blink-rate", label: "X" })).toBe("X");
  });
  test("демо переводится; цена берётся из данных", () => {
    expect(demoProjectTitle("en", { id: "demo-steppe-morning", title: "Утро в степи" })).toBe("Morning on the Steppe");
    expect(engineNote("en", { id: "kling", note: "r", usdPerSecond: 0.126 })).toContain("$0.126/s");
    expect(engineNote("kk", { id: "local-ffmpeg", note: "r", usdPerSecond: 0 })).toContain("$0");
    expect(engineNote("en", { id: "kling", note: "рус", usdPerSecond: null })).toBe("рус");
  });
  test("клиент использует словарь везде, где показывал сырое значение", () => {
    const src = readFileSync(join(__dirname, "..", "_client.tsx"), "utf8");
    expect(src.startsWith('"use client"')).toBe(true);
    expect(src).not.toMatch(/\{c\.label\}|\{e\.label\}|\{e\.note\}|\{s\.title\}|\{project\.title\}|provenance\.disclosure\}/);
  });
});
