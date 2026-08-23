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
const enrollments = new Map<
  string,
  {
    id: string; courseId: string; userId: string; progress: number;
    enrolledAt: string; lastActivityAt?: string;
  }
>();
const certs = new Map<string, Record<string, string>>();
const bookmarks = new Map<string, { userId: string; courseId: string; bookmarkedAt: string }>();
const activity = new Set<string>();
/** Метка, которую может поставить ТОЛЬКО база — память такую не породит. */
const DB_ACTIVITY_STAMP = "2026-08-23T09:41:07.000Z";

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
        // enrolledAt в базе NOT NULL DEFAULT NOW(); в стенде его не было, и
        // сортировка обзора падала на undefined.localeCompare — 500. Дефект был
        // в стенде, а не в маршруте, поэтому подставляем настоящее значение,
        // а не прикрываем маршрут значением по умолчанию.
        enrollments.set(p[0], {
          id: p[0], courseId: p[1], userId: p[2], progress: 0,
          enrolledAt: new Date().toISOString(),
        });
        return { rows: [{ id: p[0] }], rowCount: 1 };
      }
      if (s.includes('UPDATE "QLearnCourse"')) return { rows: [], rowCount: 1 };
      if (s.includes('JOIN "QLearnCourse"')) {
        // Список моих зачислений вместе с курсом. Ветку держим ОТДЕЛЬНО от
        // выборки по id: обе содержат FROM "QLearnEnrollment", и без этого
        // условия JOIN попадал в ветку «найти по id» и отвечал пустотой —
        // тест краснел бы на исправном коде.
        const rows = [...enrollments.values()]
          .filter((e) => e.userId === p[0])
          .map((e) => ({
            ...e,
            // Стенд уважает СПИСОК КОЛОНОК: без этого «JOIN потерял название»
            // было не отличить от исправного кода — мутация проходила молча.
            courseTitle: s.includes('c."title"') ? "Настоящий курс" : null,
            category: s.includes('c."category"') ? "tech" : null,
            level: s.includes('c."level"') ? "beginner" : null,
            description: s.includes('c."description"') ? "описание" : null,
          }));
        return { rows, rowCount: rows.length };
      }
      if (s.includes('FROM "QLearnEnrollment"')) {
        const e = enrollments.get(p[0]);
        return e ? { rows: [e], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (s.includes('UPDATE "QLearnEnrollment"')) {
        const e = enrollments.get(p[0]);
        if (!e) return { rows: [], rowCount: 0 };
        e.progress = Number(p[1]);
        // Колонку трогаем ТОЛЬКО если её обновляет сам запрос: иначе
        // «перестали писать lastActivityAt» было бы не отличить от исправного
        // кода — мутация проходила молча.
        // Значение НАРОЧНО узнаваемое и не «сейчас»: память в этот же миг
        // кладёт свой new Date(), и два одинаковых по миллисекунде значения
        // не дали бы отличить чтение колонки от чтения памяти.
        if (s.includes('"lastActivityAt" = NOW()')) e.lastActivityAt = DB_ACTIVITY_STAMP;
        return { rows: [{ ...e }], rowCount: 1 };
      }
      if (s.includes('INSERT INTO "QLearnBookmark"')) {
        const k = `${p[0]}::${p[1]}`;
        if (bookmarks.has(k)) return { rows: [], rowCount: 0 };   // ON CONFLICT DO NOTHING
        bookmarks.set(k, { userId: p[0], courseId: p[1], bookmarkedAt: new Date().toISOString() });
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('DELETE FROM "QLearnBookmark"')) {
        const had = bookmarks.delete(`${p[0]}::${p[1]}`);
        return { rows: [], rowCount: had ? 1 : 0 };
      }
      if (s.includes('FROM "QLearnBookmark"')) {
        const rows = [...bookmarks.values()].filter((b) => b.userId === p[0]);
        return { rows, rowCount: rows.length };
      }
      if (s.includes('INSERT INTO "QLearnActivity"')) {
        activity.add(`${p[0]}::${p[1]}`);
        return { rows: [], rowCount: 1 };
      }
      if (s.includes('FROM "QLearnActivity"')) {
        const rows = [...activity]
          .filter((k) => k.startsWith(`${p[0]}::`))
          .map((k) => ({ day: k.split("::")[1], touchedAt: new Date().toISOString() }));
        return { rows, rowCount: rows.length };
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

  test("обзор обучения видит курс при живой базе, а не пустоту", async () => {
    // Раздел «Continue learning» на странице /qlearn питается этой ручкой.
    // Она не обращалась к базе НИ РАЗУ и потому была пуста на проде всегда.
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;

    const fresh = await request(app())
      .get("/x/me/progress")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(fresh.status).toBe(200);
    expect(fresh.body?.summary?.total, "сводка пуста при живой базе").toBeGreaterThan(0);
    expect(
      fresh.body?.notStarted?.[0]?.course?.title,
      "название курса не доехало: JOIN потерян",
    ).toBe("Настоящий курс");

    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 50 });

    const midway = await request(app())
      .get("/x/me/progress")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(
      midway.body?.continueLearning?.some((x: { enrollmentId: string }) => x.enrollmentId === id),
      "начатый курс не попал в «продолжить обучение»",
    ).toBe(true);
  });

  test("мои зачисления отдают курс, а не голый идентификатор", async () => {
    await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const res = await request(app())
      .get("/x/me/enrollments")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body?.enrollments?.[0]?.courseTitle).toBe("Настоящий курс");
  });

  test("закладка ложится в базу, а не в память процесса", async () => {
    const before = bookmarks.size;
    const add = await request(app())
      .post(`/x/courses/${COURSE_ID}/bookmark`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(add.status, `закладка не поставлена: ${JSON.stringify(add.body)}`).toBe(201);
    expect(bookmarks.size, "в базу ничего не ушло — закладка исчезнет при выкатке").toBe(before + 1);

    const again = await request(app())
      .post(`/x/courses/${COURSE_ID}/bookmark`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(again.status, "повтор породил вторую строку").toBe(200);
    expect(again.body?.alreadyBookmarked).toBe(true);

    const list = await request(app())
      .get("/x/me/bookmarks")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(list.status).toBe(200);
    expect(list.body?.total).toBeGreaterThan(0);
    expect(
      list.body?.bookmarks?.[0]?.course?.title,
      "карточка курса не подтянулась из базы",
    ).toBe("Настоящий курс");

    const off = await request(app())
      .delete(`/x/courses/${COURSE_ID}/bookmark`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(off.body?.removed, "снятие закладки не дошло до базы").toBe(true);
    expect(bookmarks.size).toBe(before);
  });

  test("день занятий отмечается в базе и виден в серии", async () => {
    await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(activity.size, "запись на курс не отметила день занятий").toBeGreaterThan(0);

    const streak = await request(app())
      .get("/x/me/streak")
      .set("Authorization", `Bearer ${TOKEN}`);
    expect(streak.status).toBe(200);
    expect(streak.body?.activeToday, "сегодняшний день не попал в серию").toBe(true);
    expect(streak.body?.current).toBeGreaterThan(0);
  });

  test("занятие проставляет дату последней активности в базе", async () => {
    // Порядок «продолжить обучение» держится на этой колонке. Пока она жила в
    // памяти процесса, список после каждой выкатки выстраивался по дате
    // записи на курс, а не по тому, чем человек занимался вчера.
    const enr = await request(app())
      .post(`/x/courses/${COURSE_ID}/enroll`)
      .set("Authorization", `Bearer ${TOKEN}`);
    const id = enr.body.enrollmentId as string;
    expect(enrollments.get(id)?.lastActivityAt, "до занятия колонка должна быть пуста").toBeUndefined();

    await request(app())
      .patch(`/x/enrollments/${id}/progress`)
      .set("Authorization", `Bearer ${TOKEN}`)
      .send({ progress: 30 });

    expect(
      enrollments.get(id)?.lastActivityAt,
      "дата последней активности не доехала до базы",
    ).toBeTruthy();

    const overview = await request(app())
      .get("/x/me/progress")
      .set("Authorization", `Bearer ${TOKEN}`);
    const row = overview.body?.continueLearning?.find(
      (x: { enrollmentId: string }) => x.enrollmentId === id,
    );
    expect(row?.lastActivityAt, "обзор взял дату не из колонки, а из памяти").toBe(
      DB_ACTIVITY_STAMP,
    );
  });
});
