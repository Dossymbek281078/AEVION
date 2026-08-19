import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Таблица лидеров задачи дня не выдумывается. 19.08.2026.
//
// Здесь стояла mockLeaderboard(): сто игроков с именами НАСТОЯЩИХ гроссмейстеров
// (Magnus, Hikaru, Ding) и сериями до 365 дней, показанные ровно как живые —
// медали, флаги, огонь. Живых игроков при этом ноль.
//
// Ту же выдумку из ста seed-игроков убрали из бэкенда 10.08, а фронт продолжал
// сочинять свою независимо: один источник лжи заменили, второй остался.

const SRC = path.join(__dirname, "..", "daily", "page.tsx");
const src = () => stripComments(fs.readFileSync(SRC, "utf-8"));

describe("таблица лидеров берётся с сервера", () => {
  test("генератора выдуманных игроков больше нет", () => {
    const s = src();
    expect(s).not.toMatch(/function mockLeaderboard/);
    // И списка имён, которым он подписывал выдумку: держать его «на всякий
    // случай» значит однажды снова использовать.
    expect(s).not.toMatch(/const NAMES = \[/);
  });

  test("имена живых гроссмейстеров не зашиты в страницу", () => {
    // Показывать реальных людей как своих пользователей нельзя.
    const s = src();
    for (const name of ["Magnus", "Hikaru", "Nakamura", "Carlsen"]) {
      expect(s).not.toContain(`'${name}'`);
    }
  });

  test("данные приходят из ручки таблицы лидеров", () => {
    expect(src()).toMatch(/cyberchess-daily\/leaderboard/);
  });

  test("три состояния различаются словами", () => {
    const s = src();
    expect(s).toMatch(/lbState/);
    expect(s).toMatch(/Загружаем таблицу/);
    expect(s).toMatch(/не удалось загрузить/);
    expect(s).toMatch(/ещё никто не решил/);
  });

  test("отказ не выдаётся за пустоту", () => {
    // Ключевое: пустой список и упавший запрос выглядели бы одинаково — пустой
    // таблицей. Для человека это разные вещи: в первом случае он первый, во
    // втором мы просто не знаем.
    const s = src();
    expect(s).toMatch(/daily-lb-failed/);
    expect(s).toMatch(/daily-lb-empty/);
    expect(s).toMatch(/Это не значит, что она пуста/);
  });
});

describe("название таблицы соответствует тому, что в ней лежит", () => {
  test("сказано, что это личные рекорды, а не серия на сегодня", () => {
    // Сервер хранит МАКСИМАЛЬНУЮ серию игрока за всё время (Math.max при
    // обновлении). «Top-100 Streaks» читалось как «сейчас»: человек с серией 3
    // не понял бы, почему рядом 40 у того, кто месяц не заходил.
    const s = src();
    expect(s).toMatch(/Лучшие серии/);
    expect(s).toMatch(/Личный рекорд/);
    expect(s).not.toMatch(/Top-100 Streaks/);
  });
});
