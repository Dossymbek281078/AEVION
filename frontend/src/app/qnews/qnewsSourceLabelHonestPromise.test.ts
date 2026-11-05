import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tQnews } from "./i18n";
import { MODULE_NAMES } from "@/data/moduleNames";

const читать = (f: string) => readFileSync(join(__dirname, f), "utf8");

describe("QNews: подпись источника и честное обещание", () => {
  test("подпись «Источник: Hacker News» на ru/en/kk", () => {
    expect(tQnews("ru", "card.source", { name: "Hacker News" })).toBe("Источник: Hacker News");
    expect(tQnews("en", "card.source", { name: "Hacker News" })).toBe("Source: Hacker News");
    expect(tQnews("kk", "card.source", { name: "Hacker News" })).toBe("Дереккөз: Hacker News");
  });
  test("счётчики подписываются на языке интерфейса", () => {
    expect(tQnews("en", "card.hnStats", { points: 5, comments: 2 })).toBe("▲ 5 points · 2 comments");
    expect(tQnews("ru", "card.hnStats", { points: 5, comments: 2 })).toContain("комментариев");
  });
  test("страницы не обещают отраслевой агрегатор", () => {
    for (const f of ["layout.tsx", "i18n.ts", "opengraph-image.tsx"]) {
      expect(читать(f), f).not.toMatch(/Industry news|Aggregator|Отраслевые новости|салалық жаңалықтары/i);
    }
    const sub = JSON.stringify(MODULE_NAMES["qnews"] ?? "");
    expect(sub).not.toMatch(/Отраслевой|Industry/i);
    expect(sub).toContain("Hacker News");
  });
});
