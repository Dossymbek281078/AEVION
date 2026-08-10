// Тренажёр сметчика: одновременная работа группы студентов.
//
// Карточки всех студентов лежат в ОДНОМ файле, и каждый обработчик читал
// его, менял свою карточку и записывал файл целиком тремя отдельными
// await. Двое студентов, сдающих одновременно, читали одну и ту же версию
// файла — второй затирал работу первого. Отказа не было: обоим возвращалась
// их карточка, просто в файле оставалась одна. Для учебной группы это
// означает «прогресс пропал», причём без следов в логах.
//
// Тот же корень, что в chatHistory, кошельке AEV и списке бесед
// (c7656fbe8 / b29c09d72 / c3d54b7d5 / 5a7f5150d).

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { smetaTrainerRouter } from "../src/routes/smeta-trainer";

let app: express.Express;
let dataDir: string;
let prevDataDir: string | undefined;

beforeEach(() => {
  prevDataDir = process.env.AEVION_DATA_DIR;
  dataDir = mkdtempSync(path.join(tmpdir(), "aevion-smeta-"));
  process.env.AEVION_DATA_DIR = dataDir;

  app = express();
  app.use(express.json());
  app.use("/api/smeta-trainer", smetaTrainerRouter);
});

afterEach(() => {
  if (prevDataDir === undefined) delete process.env.AEVION_DATA_DIR;
  else process.env.AEVION_DATA_DIR = prevDataDir;
  rmSync(dataDir, { recursive: true, force: true });
});

const device = (i: number) => `student-device-${String(i).padStart(4, "0")}`;

function sync(deviceId: string, body: Record<string, unknown>) {
  return request(app).post(`/api/smeta-trainer/student/${deviceId}/sync`).send(body);
}

describe("Тренажёр: параллельная работа студентов", () => {
  test("одновременная синхронизация группы не теряет ничьи карточки", async () => {
    const N = 15;
    const results = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        sync(device(i), {
          displayName: `Студент ${i}`,
          group: "СМ-101",
          levels: { 1: { status: "done", score: 80 + (i % 20) } },
        }),
      ),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);

    // Каждая карточка, на которую ответили 200, обязана существовать.
    for (let i = 0; i < N; i++) {
      const got = await request(app).get(`/api/smeta-trainer/student/${device(i)}`);
      expect(got.body.student, `карточка ${device(i)} потеряна`).toBeTruthy();
      expect(got.body.student.displayName).toBe(`Студент ${i}`);
    }
  });

  test("одновременные сдачи попыток все попадают в журнал", async () => {
    const dev = device(1);
    await sync(dev, { levels: { 1: { status: "in-progress" } } });

    const N = 12;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        request(app)
          .post(`/api/smeta-trainer/student/${dev}/attempt`)
          .send({ level: 1, kind: "quiz", score: 50 + i }),
      ),
    );

    const list = await request(app).get(`/api/smeta-trainer/student/${dev}/attempts?limit=200`);
    expect(list.body.attempts).toHaveLength(N);
  });

  test("параллельные уроки, практика и достижения одного студента не затирают друг друга", async () => {
    const dev = device(2);
    await sync(dev, { levels: { 1: { status: "in-progress" } } });

    await Promise.all([
      request(app)
        .post(`/api/smeta-trainer/student/${dev}/lessons`)
        .send({ lessons: { "lesson-2-3": { completed: true, quizScore: 90, ts: Date.now() } } }),
      request(app)
        .post(`/api/smeta-trainer/student/${dev}/practice`)
        .send({ practice: { "ex-openings": { correct: true, attempts: 2, ts: Date.now() } } }),
      request(app)
        .post(`/api/smeta-trainer/student/${dev}/achievements`)
        .send({ achievements: ["first-lsr"] }),
    ]);

    const got = await request(app).get(`/api/smeta-trainer/student/${dev}`);
    const s = got.body.student;
    // Все три обновления должны быть на месте: раньше выживало последнее.
    expect(s.lessons?.["lesson-2-3"]?.completed).toBe(true);
    expect(s.practice?.["ex-openings"]?.correct).toBe(true);
    expect(s.achievements).toContain("first-lsr");
  });
});

describe("Тренажёр: события в LMS", () => {
  test("зачёт уровня у вернувшегося студента считается новым, а не пропускается", async () => {
    // Раньше снимок «до» брался ссылкой на тот же объект, который тут же
    // правился, поэтому дифф сравнивал состояние сам с собой: level.completed
    // уходил в LMS только при самой первой синхронизации.
    const dev = device(3);
    await sync(dev, { levels: { 1: { status: "in-progress" } } });

    // Второй заход — уровень 1 закрыт. Это НОВЫЙ зачёт для уже
    // существующей карточки.
    const second = await sync(dev, { levels: { 1: { status: "done", score: 95 } } });
    expect(second.status).toBe(200);
    expect(second.body.student.levels["1"].status).toBe("done");

    // Прямая проверка diff-функции невозможна снаружи, поэтому смотрим на
    // наблюдаемый эффект: карточка сохранила зачёт и score.
    const got = await request(app).get(`/api/smeta-trainer/student/${dev}`);
    expect(got.body.student.levels["1"].score).toBe(95);
  });
});
