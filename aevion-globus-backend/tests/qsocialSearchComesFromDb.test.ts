import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Поиск, лента тега и «в тренде» у QSocial берутся из базы.
 *
 * Замер 28.08.2026: посты пишутся в "QSocialPost" (см. POST /posts, там всё
 * верно), а эти три ручки читали карту ПАМЯТИ. На проде она пуста после каждой
 * выкатки, значит поиск не находил ничего и никогда — отвечая 200 и пустым
 * списком. Пустой ответ человек читает как «такого нет», а не как «сломано».
 *
 * Проверять это на проде бесполезно: постов там сейчас ноль, и пустой ответ
 * одинаков у исправного и у сломанного кода. Отрицательный контроль совпадает
 * с предметом — значит проба слепа, и доказательство только здесь.
 */

// Колонки ровно те, что в "QSocialPost": tags это TEXT[], а не строка.
const posts = [
  { id: "p1", userId: "u1", content: "Запускаем шахматы", type: "text",
    likesCount: 3, commentsCount: 0, isPublic: true, tags: ["chess", "launch"],
    createdAt: "2026-08-28T10:00:00.000Z" },
  { id: "p2", userId: "u2", content: "Про здоровье и сон", type: "text",
    likesCount: 1, commentsCount: 0, isPublic: true, tags: ["health"],
    createdAt: "2026-08-28T09:00:00.000Z" },
  { id: "p3", userId: "u3", content: "Ещё раз про chess", type: "text",
    likesCount: 0, commentsCount: 0, isPublic: true, tags: ["chess"],
    createdAt: "2026-08-28T08:00:00.000Z" },
];

const seen: string[] = [];

// Стенд НЕ повторяет логику обработчика — он исполняет то, что тот прислал:
// разбирает условие запроса и применяет его к данным. Стенд, который сам решает,
// что вернуть, зелен и на сломанном коде: 28.08 я на этом уже попался с QMedia.
vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      const head = s.trimStart().toUpperCase();
      if (head.startsWith("CREATE") || head.startsWith("ALTER") || head.startsWith("SELECT 1")) {
        return { rows: [], rowCount: 0 };
      }
      seen.push(s);
      if (!s.includes('"QSocialPost"')) return { rows: [], rowCount: 0 };

      if (s.includes("GROUP BY")) {
        const c = new Map<string, number>();
        for (const p of posts) for (const t of p.tags) c.set(t, (c.get(t) ?? 0) + 1);
        // Порядок берём ИЗ ЗАПРОСА. Стенд, который всегда сортирует по убыванию,
        // остаётся зелёным и когда обработчик просит возрастание — то есть
        // обещает проверку порядка, не проверяя его.
        const desc = /ORDER BY\s+count\s+DESC/i.test(s);
        const rows = [...c].map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => (desc ? b.count - a.count : a.count - b.count) || a.tag.localeCompare(b.tag))
          .slice(0, 10);
        return { rows, rowCount: rows.length };
      }

      let out = posts.filter((p) => p.isPublic);
      if (s.includes("lower(t) = $1")) {
        const tag = String(params?.[0] ?? "");
        out = out.filter((p) => p.tags.some((t) => t.toLowerCase() === tag));
      } else if (s.includes("ILIKE $1")) {
        // Экранирование в шаблоне обязано что-то значить: "!" отменяет
        // подстановочный смысл следующего символа, ровно как ESCAPE в SQL.
        const raw = String(params?.[0] ?? "");
        let rx = "";
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i];
          if (ch === "!") { rx += (raw[++i] ?? "").replace(/[.*+?^${}()|[\]]/g, "\$&"); continue; }
          if (ch === "%") { rx += ".*"; continue; }
          if (ch === "_") { rx += "."; continue; }
          rx += ch.replace(/[.*+?^${}()|[\]]/g, "\$&");
        }
        const re = new RegExp("^" + rx + "$", "i");
        // По тегам ищем, ТОЛЬКО если запрос об этом просит. Стенд, который
        // всегда смотрит и в теги, пропускал бы обработчик, ищущий лишь по
        // тексту, — проверено мутацией: без этой строки она проходит молча.
        const alsoTags = s.includes('unnest("tags")');
        out = out.filter((p) => re.test(p.content) || (alsoTags && p.tags.some((t) => re.test(t))));
      }
      return { rows: out.map((p) => ({ ...p })), rowCount: out.length };
    },
  }),
}));
vi.mock("../src/lib/ensureQSocialTables", () => ({
  ensureQSocialTables: async () => {},
  isQSocialDbReady: () => true,
  getQSocialDbError: () => null,
}));

import { qsocialRouter } from "../src/routes/qsocial";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qsocialRouter);
  return a;
}

describe("QSocial ищет по базе, а не по памяти процесса", () => {
  test("поиск по слову находит посты из базы", async () => {
    const res = await request(app()).get("/x/search?q=chess");
    expect(res.status).toBe(200);
    const ids = (res.body.posts as Array<{ id: string }>).map((p) => p.id).sort();
    expect(ids, "поиск пуст при полной базе").toEqual(["p1", "p3"]);
  });

  test("поиск спрашивает именно базу", () => {
    expect(seen.some((s) => s.includes('"QSocialPost"')), "к базе не обращались вовсе").toBe(true);
  });

  test("подстановочный знак из запроса человека не ищет всё подряд", async () => {
    // Без экранирования "%" в ILIKE означает "любой текст", и поиск по одному
    // символу вернул бы всю ленту — притворившись очень удачным поиском.
    const res = await request(app()).get("/x/search?q=%25");
    expect(res.status).toBe(200);
    expect(res.body.posts.length, "процент сработал подстановочным знаком").toBe(0);
  });

  test("лента тега берёт посты этого тега из базы", async () => {
    const res = await request(app()).get("/x/hashtag/health");
    expect(res.status).toBe(200);
    expect(res.body.posts.map((p: { id: string }) => p.id)).toEqual(["p2"]);
  });

  test("в тренде — счёт по базе, самый частый первым", async () => {
    const res = await request(app()).get("/x/trending-tags");
    expect(res.status).toBe(200);
    expect(res.body.tags[0], "тренды пусты или посчитаны не по базе")
      .toEqual({ tag: "chess", count: 2 });
  });
});
