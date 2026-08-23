import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

/**
 * Завершение курса и выдача сертификата на ЖИВОЙ базе.
 *
 * Замер 23.08.2026: запись на курс при живой базе уходит в Postgres и НЕ
 * дублируется в memEnrollments, а POST /enrollments/:id/complete читает
 * ИМЕННО memEnrollments — то есть на проде отвечает «Enrollment not found»
 * о зачислении, которое сам же и создал минуту назад.
 *
 * Следствие: курс нельзя завершить, сертификат нельзя получить НИКОГДА,
 * пока база жива. Модуль продаётся за $15/мес и входит в medium/full.
 *
 * Тест намеренно идёт по ПОЛОЖИТЕЛЬНОМУ пути: база работает. Отказ базы —
 * отдельный класс, он проверяется в других файлах.
 */

const COURSE_ID = "course-1";
const USER = "learner-1";
const enrollments = new Map<string, { id: string; courseId: string; userId: string; progress: number }>();
const certs = new Map<string, Record<string, string>>();

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      const p = (params ?? []) as string[];
      if (s.trimStart().toUpperCase().startsWith("CREATE") || s.trimStart().toUpperCase().startsWith("ALTER")) {
        return { rows: [], rowCount: 0 };
      }
      if (s.includes('FROM "QLearnCourse"')) {
        return p[0] === COURSE_ID
          ? { rows: [{ id: COURSE_ID, title: "Настоящий курс", authorId: "author-1" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (s.includes('INSERT INTO "QLearnEnrollment"')) {
        enrollments.set(p[0], { id: p[0], courseId: p[1], userId: p[2], progress: 0 });
        return { rows: [{ id: p[0] }], rowCount: 1 };
      }
      if (s.includes('UPDATE "QLearnCourse"')) return { rows: [], rowCount: 1 };
      if (s.includes('FROM "QLearnEnrollment"')) {
        const e = enrollments.get(p[0]);
        return e ? { rows: [e], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (s.includes('UPDATE "QLearnEnrollment"')) {
        const e = enrollments.get(p[0]);
        if (!e) return { rows: [], rowCount: 0 };
        e.progress = Number(p[1]);
        return { rows: [{ ...e }], rowCount: 1 };
      }
      if (s.includes('INSERT INTO "QLearnCertificate"')) {
        if (certs.has(p[1])) return { rows: [], rowCount: 0 };   // ON CONFLICT DO NOTHING
        const row = {
          id: p[0], enrollmentId: p[1], courseId: p[2], userId: p[3],
          courseTitle: p[4], certificateNumber: p[5], completedAt: p[6],
        };
        certs.set(p[1], row);
        return { rows: [row], rowCount: 1 };
      }
      if (s.includes('FROM "QLearnCertificate"')) {
        const row = s.includes('"enrollmentId"')
          ? certs.get(p[0])
          : [...certs.values()].find((c) => c.certificateNumber === p[0] || c.userId === p[0]);
        return row ? { rows: [row], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    },
  }),
  isDbConfigured: () => true,
}));
vi.mock("../src/lib/ensureQLearnTables", () => ({
  ensureQLearnTables: async () => {},
  isQLearnDbReady: () => true,
  getQLearnDbError: () => null,
}));

import { qlearnRouter } from "../src/routes/qlearn";

const TOKEN = jwt.sign({ sub: USER }, "dev-auth-secret", { algorithm: "HS256", expiresIn: "1h" });

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qlearnRouter);
  return a;
}

describe("курс можно завершить, когда база жива", () => {
  test("контроль: запись на курс проходит и отдаёт enrollmentId", async () => {
    const res = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status, `запись не прошла: ${JSON.stringify(res.body)}`).toBe(201);
    expect(typeof res.body.enrollmentId).toBe("string");
  });

  test("прогресс доходит до 100 по тому же id", async () => {
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    const res = await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 100 });
    expect(res.status, `прогресс не записался: ${JSON.stringify(res.body)}`).toBe(200);
  });

  test("завершение НЕ отвечает «зачисления нет» о своём же зачислении", async () => {
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 100 });

    const res = await request(app())
      .post(`/x/enrollments/${id}/complete`)
      .set("Authorization", `Bearer ${TOKEN}`);

    expect(
      res.status,
      "зачисление создано этой же ручкой, а завершение его не видит: чтение идёт мимо базы",
    ).not.toBe(404);
    // Код может быть и 201 (выдали сейчас), и 200 (сертификат уже выдан
    // автоматически при достижении 100%). Утверждаем СВОЙСТВО — сертификат
    // получен, — а не мою формулировку: иначе тест охраняет мой код, а не
    // обещание модуля.
    expect([200, 201]).toContain(res.status);
    expect(res.body?.certificate?.certificateNumber).toBeTruthy();
  });

  test("в сертификате настоящее название курса, а не Unknown Course", async () => {
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 100 });
    const res = await request(app())
      .post(`/x/enrollments/${id}/complete`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.body?.certificate?.courseTitle).toBe("Настоящий курс");
  });

  test("сертификат выдаётся уже при 100% — без отдельного вызова завершения", async () => {
    // На живой базе у ветки PATCH был свой выход до общего хвоста, и автовыдача
    // при 100% не отрабатывала НИКОГДА — только там, где базы нет.
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 100 });

    const res = await request(app())
      .get(`/x/enrollments/${id}/certificate`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status, "после 100% сертификата нет: автовыдача не отработала").toBe(200);
    expect(res.body?.certificate?.courseTitle).toBe("Настоящий курс");
  });

  test("сертификат ЛЁГ В БАЗУ, а не в память процесса", async () => {
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    const before = certs.size;
    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 100 });
    expect(certs.size, "в базу ничего не записано — сертификат живёт до перезапуска").toBe(before + 1);
  });
});
