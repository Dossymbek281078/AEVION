import { describe, test, expect, vi } from "vitest";

// Даты образцов не протухают. 19.08.2026.
//
// Замер на боевом проде: семь турниров из двенадцати числились «предстоящими»,
// а время старта у них прошло 88–94 дня назад — даты были записаны в мае.
// Человек, открывший раздел, видит «Скоро» и дату из мая и решает, что здесь
// всё заброшено. Ровно это увидел бы пришедший по ссылке 30 августа.
//
// Зашитая дата в образце протухает ВСЕГДА, вопрос только когда.

vi.hoisted(() => {
  process.env.DATABASE_URL = "";
  const nodeOs = require("node:os") as typeof import("node:os");
  const nodePath = require("node:path") as typeof import("node:path");
  const nodeFs = require("node:fs") as typeof import("node:fs");
  process.env.CYBERCHESS_TOURNAMENTS_DIR = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "cc-seeddate-"));
});

import express from "express";
import request from "supertest";

async function список() {
  const router = (await import("../src/routes/cyberchessTournaments")).default;
  const a = express();
  a.use(express.json());
  a.use("/api/cyberchess-tournaments", router);
  const r = await request(a).get("/api/cyberchess-tournaments/list");
  return (r.body?.tournaments ?? []) as Array<Record<string, any>>;
}

describe("образцы не выглядят заброшенными", () => {
  test("ни один предстоящий образец не стартовал в прошлом", async () => {
    const ts = await список();
    const просроченные = ts
      .filter((t) => t.status === "upcoming" && Date.parse(t.startsAt) < Date.now())
      .map((t) => `${t.id} (${t.startsAt})`);
    expect(просроченные).toEqual([]);
  });

  test("идущие начались недавно, а не месяцы назад", async () => {
    const ts = await список();
    const сутки = 24 * 3600_000;
    const старые = ts
      .filter((t) => t.status === "live" && Date.now() - Date.parse(t.startsAt) > сутки)
      .map((t) => t.id);
    expect(старые).toEqual([]);
  });

  test("завершённый действительно в прошлом — иначе это не образец, а бессмыслица", async () => {
    const ts = await список();
    const завершённые = ts.filter((t) => t.status === "finished");
    expect(завершённые.length).toBeGreaterThan(0);
    for (const t of завершённые) {
      expect(Date.parse(t.startsAt)).toBeLessThan(Date.now());
    }
  });

  test("даты не зашиты в исходнике — проверяется ПРИЧИНА, а не следствие", () => {
    // Три утверждения выше проверяют следствие, и у них есть слабость: верни
    // кто-нибудь зашитую дату будущим числом — они останутся зелёными ещё
    // месяцы, пока она снова не протухнет. Эта проверка ловит саму причину.
    //
    // Через подмену часов сделать не вышло: модуль кэширует состояние при
    // первом импорте, и resetModules его здесь не пересобирает. Признаю прямо:
    // проверка по исходнику слабее поведенческой, но надёжнее обхода, который
    // я не смог заставить работать честно.
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const src = fs.readFileSync(
      path.join(__dirname, "..", "src", "routes", "cyberchessTournaments.ts"), "utf-8");
    const зашитые = src.match(/startsAt:\s*"20\d\d-/g) || [];
    expect(зашитые).toEqual([]);
    expect(src).toMatch(/function seedDate\(/);
  });
});
