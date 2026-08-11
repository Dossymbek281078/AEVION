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

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { smetaTrainerRouter } from "../src/routes/smeta-trainer";

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
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  if (prevSecret === undefined) delete process.env.AUTH_JWT_SECRET;
  else process.env.AUTH_JWT_SECRET = prevSecret;
  rmSync(dataDir, { recursive: true, force: true });
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
    // Отрицательная проверка: окно короткое намеренно — здесь ждать нечего,
    // и удлинять его значило бы удлинять каждый прогон впустую.
    expect(await waitForEvent("level.completed", 1000)).toBeNull(); // ещё не сдан

    await sync({ 1: { status: "done", score: 95 } });

    const ev = await waitForEvent("level.completed");
    expect(ev, "событие level.completed не дошло до LMS").toBeTruthy();
    expect(ev!.studentId).toBe(DEVICE);
    expect(ev!.level).toBe(1);
    expect(ev!.score).toBe(95);
  });

  test("повторная синхронизация того же зачёта событие НЕ дублирует", async () => {
    // Обратная сторона: дифф должен считать новым только то, что новое.
    await registerHook(["level.completed"]);

    await sync({ 1: { status: "done", score: 80 } });
    expect(await waitForEvent("level.completed")).toBeTruthy();

    const before = received.length;
    await sync({ 1: { status: "done", score: 80 } });
    await new Promise((r) => setTimeout(r, 1500));
    expect(received.length, "зачёт отправлен в LMS повторно").toBe(before);
  });

  test("доставка отмечается в статистике вебхука", async () => {
    await registerHook(["level.completed"]);
    await sync({ 1: { status: "done", score: 70 } });
    expect(await waitForEvent("level.completed")).toBeTruthy();

    const list = await request(app)
      .get("/api/smeta-trainer/admin/webhooks")
      .set("Authorization", `Bearer ${token()}`);
    const w = list.body.webhooks?.[0];
    expect(w?.lastSentAt, "доставка не записана").toBeTruthy();
    expect(w?.failureCount).toBe(0);
  });
});
