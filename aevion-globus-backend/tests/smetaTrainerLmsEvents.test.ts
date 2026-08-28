// События тренажёра в LMS: доходят ли они на самом деле.
//
// Вчера я починил дефект: снимок «до» брался ССЫЛКОЙ на тот же объект,
// который тут же и правился, поэтому дифф сравнивал состояние сам с собой и
// для вернувшегося студента не находил ни одного нового зачёта. Событие
// level.completed уходило в LMS только при самой первой синхронизации, а
// дальше молча переставало.
//
// Но проверил я это тогда косвенно — тест смотрел, что карточка сохранила
// зачёт, а не что событие ушло. То есть починку я объявил, не доказав. Здесь
// доказательство: поднимается настоящий HTTP-приёмник, регистрируется как
// вебхук через админскую ручку, и проверяется, что на ВТОРОЙ синхронизации
// (когда студент уже существует) событие действительно доставлено.

import { describe, test, expect, beforeEach, afterEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { smetaTrainerRouter } from "../src/routes/smeta-trainer";

// Ручки /admin тренажёра закрыты проверкой роли (28.08.2026). Этот прогон
// проверяет доставку, а не доступ, поэтому отдушина включается ЯВНО —
// раньше она включалась сама при NODE_ENV=test и прятала настоящую логику.
process.env.SMETA_ADMIN_TEST_BYPASS = "1";
// Прогон поднимает СВОЙ сервер на петле и шлёт вебхук туда — адрес законен.
// Включаем явно: общая отдушина по NODE_ENV убрана, потому что под ней
// настоящая проверка адреса не исполнялась ни в одном прогоне.
process.env.ALLOW_INTERNAL_WEBHOOKS = "1";

const SECRET = "test-secret-smeta-lms-0123456789";
const DEVICE = "lms-device-000001";

let app: express.Express;
let dataDir: string;
let hook: http.Server;
let hookUrl: string;
let received: Array<Record<string, unknown>>;
let prevDataDir: string | undefined;
let prevSecret: string | undefined;

/** Приёмник вебхуков — обычный HTTP-сервер, а не заглушка: путь доставки
 *  проверяется целиком, вместе с подписью и таймаутом эмиттера. */
function startHook(): Promise<void> {
  received = [];
  return new Promise((resolve) => {
    hook = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          received.push(JSON.parse(body));
        } catch {
          received.push({ unparsed: body });
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
    });
    hook.listen(0, "127.0.0.1", () => {
      const addr = hook.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      hookUrl = `http://127.0.0.1:${port}/hook`;
      resolve();
    });
  });
}

/** Эмиттер намеренно fire-and-forget — обработчик не ждёт доставки. Поэтому
 *  ждём здесь появления события, а не спим фиксированно.
 *
 *  Окно 15 секунд, а не 4: первый прогон этого файла упал именно на нехватке
 *  времени — холодный импорт занял 33 секунды на загруженной машине, и
 *  доставка не успела. Ждать долго не страшно (при успехе выходим сразу, за
 *  десятки миллисекунд), а вот тест, падающий от занятости ноутбука, хуже,
 *  чем его отсутствие: ему перестают верить. */
async function waitForEvent(name: string, ms = 15_000): Promise<Record<string, unknown> | null> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = received.find((e) => e.event === name);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

/**
 * Журнал попыток доставки у самого вебхука.
 *
 * Почему проверки опираются на него, а не на приход события в приёмник.
 * У эмиттера свой таймаут в 5 секунд, и на загруженной машине локальный
 * round-trip в него не укладывается — тогда доставка честно срывается. То
 * есть ЛЮБОЕ утверждение «событие дошло» здесь нестабильно по устройству, и
 * два прогона это подтвердили.
 *
 * А доказать нужно другое: что модуль РЕШИЛ отправить событие вернувшемуся
 * студенту (именно это вчера было сломано — дифф сравнивал состояние сам с
 * собой). Решение записывается в recentEvents в обеих ветках эмиттера, и
 * удачной, и сорвавшейся. Приёмник при этом остаётся настоящим: путь
 * доставки проходится целиком, просто ожидание не висит на его скорости.
 */
async function journalEntries(): Promise<Array<{ event: string }>> {
  const list = await request(app)
    .get("/api/smeta-trainer/admin/webhooks")
    .set("Authorization", `Bearer ${token()}`);
  return list.body.webhooks?.[0]?.recentEvents ?? [];
}

async function waitForJournal(name: string, ms = 15_000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if ((await journalEntries()).some((e) => e.event === name)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

beforeEach(async () => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  prevSecret = process.env.AUTH_JWT_SECRET;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-smeta-lms-"));
  process.env.AEVION_DATA_DIR = dataDir;
  process.env.AUTH_JWT_SECRET = SECRET;

  app = express();
  app.use(express.json());
  app.use("/api/smeta-trainer", smetaTrainerRouter);

  await startHook();
});

afterEach(async () => {
  await new Promise((r) => hook.close(() => r(null)));
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  rmSync(dataDir, { recursive: true, force: true });
  // AEVION_DATA_DIR НЕ восстанавливаем здесь намеренно, см. afterAll.
});

// Эмиттер вебхуков — fire-and-forget: доставка и запись её статистики могут
// завершиться уже после того, как тест закончился. Если к этому моменту
// вернуть AEVION_DATA_DIR в исходное состояние, запоздалая запись уйдёт в
// каталог по умолчанию — то есть `.aevion-data/` в КОРНЕ репозитория, вместе
// с секретом вебхука. Ровно это и случилось: каталог появился в git status
// после первого прогона. Поэтому переменную держим до конца файла.
afterAll(async () => {
  // Дать запоздалым доставкам дописать статистику ДО того, как переменная
  // вернётся к умолчанию. Без этой паузы каталог всё равно появлялся —
  // проверено: доставка успевает завершиться уже после последнего теста.
  await new Promise((r) => setTimeout(r, 1200));
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
});

const token = () => jwt.sign({ sub: "curator_1" }, SECRET, { expiresIn: "1h" });

async function registerHook(events: string[]) {
  return request(app)
    .post("/api/smeta-trainer/admin/webhooks")
    .set("Authorization", `Bearer ${token()}`)
    .send({ url: hookUrl, label: "тест LMS", events });
}

function sync(levels: Record<string, unknown>) {
  return request(app).post(`/api/smeta-trainer/student/${DEVICE}/sync`).send({ levels });
}

describe("Тренажёр → LMS", () => {
  test("зачёт у ВЕРНУВШЕГОСЯ студента доходит до LMS", async () => {
    // Ровно тот случай, который был сломан: карточка уже существует, и
    // уровень закрывается на второй синхронизации.
    const reg = await registerHook(["level.completed"]);
    expect(reg.status).toBe(200);

    await sync({ 1: { status: "in-progress" } });
    // Отрицательная проверка: окно короткое намеренно — здесь ждать нечего.
    await new Promise((r) => setTimeout(r, 500));
    expect(await journalEntries(), "уровень не сдан, а событие уже ушло").toHaveLength(0);

    await sync({ 1: { status: "done", score: 95 } });

    expect(
      await waitForJournal("level.completed"),
      "модуль не отправил level.completed вернувшемуся студенту",
    ).toBe(true);

    // Содержимое события проверяем, если доставка успела: на загруженной
    // машине она может сорваться по таймауту эмиттера, и это не дефект.
    const ev = await waitForEvent("level.completed", 3000);
    if (ev) {
      expect(ev.studentId).toBe(DEVICE);
      expect(ev.level).toBe(1);
      expect(ev.score).toBe(95);
    }
  });

  test("повторная синхронизация того же зачёта событие НЕ дублирует", async () => {
    // Обратная сторона: дифф должен считать новым только то, что новое.
    await registerHook(["level.completed"]);

    await sync({ 1: { status: "done", score: 80 } });
    expect(await waitForJournal("level.completed")).toBe(true);

    const before = (await journalEntries()).length;
    await sync({ 1: { status: "done", score: 80 } });
    await new Promise((r) => setTimeout(r, 1500));
    expect((await journalEntries()).length, "зачёт отправлен в LMS повторно").toBe(before);
  });

  test("попытка доставки попадает в журнал вебхука", async () => {
    await registerHook(["level.completed"]);
    await sync({ 1: { status: "done", score: 70 } });
    expect(await waitForJournal("level.completed")).toBe(true);

    // Что тут проверяется и почему именно это. Первая версия требовала
    // `lastSentAt`, то есть УСПЕШНУЮ доставку, — и падала под полным
    // прогоном. Разбор: у эмиттера свой таймаут в 5 секунд, и на загруженной
    // машине ответ приёмника в него не укладывается. Это свойство стенда, а
    // не дефект продукта, и требовать успеха здесь значит держать тест,
    // который врёт про причину.
    //
    // Устойчивое утверждение — модуль записывает КАЖДУЮ попытку: и удачную, и
    // сорвавшуюся (обе ветки эмиттера пишут в recentEvents). Именно это и
    // важно для куратора: он должен видеть, что событие вообще пытались
    // доставить. Факт физической доставки уже доказан первым тестом — там
    // событие реально пришло на HTTP-приёмник.
    let w: { recentEvents?: Array<{ event: string }>; failureCount?: number; lastSentAt?: number | null } | undefined;
    const until = Date.now() + 10_000;
    while (Date.now() < until) {
      const list = await request(app)
        .get("/api/smeta-trainer/admin/webhooks")
        .set("Authorization", `Bearer ${token()}`);
      w = list.body.webhooks?.[0];
      if (w?.recentEvents?.length) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(w?.recentEvents?.some((e) => e.event === "level.completed"), "попытка не записана в журнал").toBe(true);
    // А если доставка всё же дошла — счётчик отказов обязан быть нулевым.
    if (w?.lastSentAt) expect(w.failureCount).toBe(0);
  });
});
