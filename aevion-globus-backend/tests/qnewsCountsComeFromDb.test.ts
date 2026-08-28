import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Счётчики, лента и сводка QNews берутся из базы.
 *
 * Замер 28.08.2026: статьи пишутся в "QNewsArticle", а три ручки считали их по
 * карте ПАМЯТИ. На проде она пуста, значит: все разделы показывали 0, RSS
 * отдавал пустую ленту, а /stats — «всего 0 статей» при полной базе.
 *
 * Пустой RSS дороже, чем кажется: часть читалок опрашивает канал, однажды
 * отдавший ноль записей, заметно реже.
 */

// Поля ровно те, что в таблице "QNewsArticle": summary, а не description.
// Первый прогон дал 500 именно на этом — стенд выдумал поле, которого нет, и
// шаблон ленты упал на undefined. Проверил схему: колонка summary есть, то
// есть виноват был стенд, а не код.
const articles = [
  { id: "a1", title: "Первая", url: "https://e/1", summary: "краткое изложение", source: "AEVION",
    category: "tech", publishedAt: "2026-08-28T10:00:00.000Z" },
  { id: "a2", title: "Вторая", url: "https://e/2", summary: "краткое изложение", source: "AEVION",
    category: "tech", publishedAt: "2026-08-28T09:00:00.000Z" },
  { id: "a3", title: "Третья", url: "https://e/3", summary: "краткое изложение", source: "Other",
    category: "business", publishedAt: "2026-08-28T08:00:00.000Z" },
];

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string) => {
      const s = String(sql ?? "");
      const head = s.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER") || head.startsWith("SELECT 1")) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes("GROUP BY") && s.includes('"QNewsArticle"')) {
        const byCat = new Map<string, number>();
        for (const a of articles) byCat.set(a.category, (byCat.get(a.category) ?? 0) + 1);
        const rows = [...byCat].map(([category, n]) => ({ category, n }));
        return { rows, rowCount: rows.length };
      }
      if (s.includes('FROM "QNewsArticle"')) {
        return { rows: articles.map((a) => ({ ...a })), rowCount: articles.length };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQNewsTables", () => ({
  ensureQNewsTables: async () => {},
  isQNewsDbReady: () => true,
  getQNewsDbError: () => null,
}));

import { qnewsRouter } from "../src/routes/qnews";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qnewsRouter);
  return a;
}

describe("QNews считает по базе, а не по памяти", () => {
  test("разделы показывают настоящие числа, а не нули", async () => {
    const res = await request(app()).get("/x/categories");
    expect(res.status).toBe(200);
    const tech = res.body.categories.find((c: { id: string }) => c.id === "tech");
    expect(tech?.count, "раздел пуст при полной базе").toBe(2);
  });

  test("RSS отдаёт статьи из базы", async () => {
    const res = await request(app()).get("/x/rss");
    expect(res.status).toBe(200);
    expect(res.text, "лента пуста при полной базе").toContain("Первая");
  });

  test("сводка считает все статьи", async () => {
    const res = await request(app()).get("/x/stats");
    expect(res.status).toBe(200);
    expect(res.body.total, "сводка показала ноль при полной базе").toBe(3);
  });
});
