import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  needsRawBody,
  requestPath,
  RAW_BODY_PATHS,
  RAW_BODY_SMALL_LIMIT,
} from "../src/lib/rawBodyPolicy";

// Кому достаются сырые байты тела — 13.08.2026.
//
// `verify` в express.json сохранял буфер на req.rawBody для ВСЕХ путей. Копии
// при этом не создаётся, но ссылка продлевает буферу жизнь до конца запроса —
// без неё он стал бы мусором сразу после разбора JSON.
//
// Замер (4 одновременных запроса по 8 МБ, ручка держит 300 мс, счётчик
// process.memoryUsage().arrayBuffers, оба порядка прогонов):
//   без сохранения: прирост 64.0 МБ и 64.0 МБ
//   со сохранением: прирост 80.1 МБ и 104.0 МБ
//
// Байты нужны десяти обработчикам, все — проверка подписи платёжного вебхука
// побайтно. Отсюда правило «мало ИЛИ путь вебхука»: список путей — единственное
// место, где ошибка стоит денег (подпись не сойдётся, платёж отклонён молча),
// поэтому порог по размеру работает даже когда список устарел.

const SRC = join(__dirname, "..", "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("needsRawBody — правило двойное и оба плеча работают", () => {
  test("малое тело получает байты на любом пути", () => {
    expect(needsRawBody("/api/anything/at/all", 1024)).toBe(true);
    expect(needsRawBody("/api/qcoreai/chat", RAW_BODY_SMALL_LIMIT)).toBe(true);
  });

  test("крупное тело на обычном пути байтов не получает", () => {
    // Ровно тот случай, ради которого правило и появилось: медиа-путь с телом в
    // мегабайтах.
    expect(needsRawBody("/api/build/ai/parse-resume", 8 * 1024 * 1024)).toBe(false);
    expect(needsRawBody("/api/devhub/media/stt", RAW_BODY_SMALL_LIMIT + 1)).toBe(false);
  });

  test("крупное тело на пути вебхука байты получает — иначе подпись не сойдётся", () => {
    for (const p of RAW_BODY_PATHS) {
      expect(needsRawBody(p, 5 * 1024 * 1024), `вебхук ${p} остался без байтов`).toBe(true);
    }
  });

  test("строка запроса и хвостовой слеш не выбивают вебхук из списка", () => {
    // Провайдер вполне может дернуть путь со слешем или параметром.
    expect(needsRawBody("/api/paypal/webhook?attempt=2", 5 * 1024 * 1024)).toBe(true);
    expect(needsRawBody("/api/paypal/webhook/", 5 * 1024 * 1024)).toBe(true);
  });

  test("requestPath нормализует, но не склеивает разные пути", () => {
    expect(requestPath("/api/x/?a=1")).toBe("/api/x");
    expect(requestPath("/")).toBe("/");
    expect(requestPath(undefined)).toBe("/");
    expect(requestPath("/api/paypal/webhook2")).not.toBe("/api/paypal/webhook");
  });
});

describe("сторож: список путей не должен отставать от читателей", () => {
  test("читателей req.rawBody не больше, чем записей в списке", () => {
    // Смысл сторожа: появится одиннадцатый обработчик, читающий сырые байты, —
    // числа разойдутся, и его путь придётся внести. Иначе он молча получит
    // undefined на крупном теле, и это будет отказ платежа, а не ошибка сборки.
    const readers: string[] = [];
    for (const f of walk(SRC)) {
      if (f.endsWith(`lib${require("node:path").sep}rawBodyPolicy.ts`)) continue;
      const src = readFileSync(f, "utf8");
      src.split("\n").forEach((line, i) => {
        if (/\.rawBody/.test(line) && /req as unknown/.test(line) && !/rawBody = buf/.test(line)) {
          readers.push(`${f.replace(SRC, "src")}:${i + 1}`);
        }
      });
    }

    // Охват: сканер обязан кого-то найти, иначе зелёный ничего не значит.
    expect(readers.length).toBeGreaterThanOrEqual(9);
    expect(
      readers.length,
      `читателей ${readers.length}, путей в списке ${RAW_BODY_PATHS.length}. Появился новый читатель — внесите его путь:\n${readers.join("\n")}`,
    ).toBeLessThanOrEqual(RAW_BODY_PATHS.length);
  });

  test("в списке нет повторов и все записи — абсолютные пути /api/...", () => {
    expect(new Set(RAW_BODY_PATHS).size).toBe(RAW_BODY_PATHS.length);
    for (const p of RAW_BODY_PATHS) {
      expect(p, `путь «${p}» не похож на смонтированный`).toMatch(/^\/api\/[a-z0-9/-]+$/);
      expect(p.endsWith("/")).toBe(false);
    }
  });
});

describe("сквозь express: байты доходят туда, куда должны", () => {
  function app() {
    const a = express();
    a.use(
      express.json({
        limit: "20mb",
        verify: (req, _res, buf) => {
          const r = req as unknown as { originalUrl?: string; url?: string; rawBody?: Buffer };
          if (needsRawBody(r.originalUrl ?? r.url, buf.length)) r.rawBody = buf;
        },
      }),
    );
    const report = (req: express.Request, res: express.Response) =>
      res.json({ has: !!(req as unknown as { rawBody?: Buffer }).rawBody });
    a.post("/api/paypal/webhook", report);
    a.post("/api/build/ai/parse-resume", report);
    return a;
  }

  const big = JSON.stringify({ pad: "x".repeat(RAW_BODY_SMALL_LIMIT * 2) });
  const small = JSON.stringify({ ok: 1 });

  test("крупный вебхук — байты есть", async () => {
    const r = await request(app()).post("/api/paypal/webhook").set("Content-Type", "application/json").send(big);
    expect(r.body.has).toBe(true);
  });

  test("крупный медиа-путь — байтов нет", async () => {
    const r = await request(app()).post("/api/build/ai/parse-resume").set("Content-Type", "application/json").send(big);
    expect(r.body.has).toBe(false);
  });

  test("малый медиа-путь — байты есть (порог, а не путь)", async () => {
    const r = await request(app()).post("/api/build/ai/parse-resume").set("Content-Type", "application/json").send(small);
    expect(r.body.has).toBe(true);
  });
});
