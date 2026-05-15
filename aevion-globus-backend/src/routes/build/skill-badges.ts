/**
 * QBuild Skill Tests & Badges — verify candidates' competencies.
 *
 * 3 built-in tests: welding / concrete / electrician
 * Passing score 70%. Badge persists in "BuildSkillBadge".
 *
 * Routes:
 *   GET    /api/build/skill-tests                list available tests
 *   GET    /api/build/skill-tests/:id            test detail + questions
 *   POST   /api/build/skill-tests/:id/submit     submit answers → grade → optional badge
 *   GET    /api/build/skill-badges/me            my badges
 *   GET    /api/build/skill-badges/user/:userId  public badges (for profile)
 */

import { Router } from "express";
import {
  buildPool as pool,
  ok,
  fail,
  requireBuildAuth,
} from "../../lib/build";

export const skillBadgesRouter = Router();

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "BuildSkillBadge" (
      "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId"     TEXT NOT NULL,
      "testId"     TEXT NOT NULL,
      "score"      INT NOT NULL,
      "passed"     BOOLEAN NOT NULL,
      "grantedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE("userId","testId")
    );
    CREATE INDEX IF NOT EXISTS idx_bsb_user ON "BuildSkillBadge" ("userId");
  `);
  tableReady = true;
}

// ── Built-in tests (hardcoded corpus) ────────────────────────────────────────

interface Question { id: string; text: string; options: string[]; correct: number; }
interface SkillTest { id: string; title: string; description: string; questions: Question[]; passingScore: number; }

const TESTS: Record<string, SkillTest> = {
  welding: {
    id: "welding",
    title: "Сварщик",
    description: "Базовые знания ручной дуговой и полуавтоматической сварки",
    passingScore: 70,
    questions: [
      { id: "w1", text: "Какой ток используется при ручной дуговой сварке?",
        options: ["Только постоянный", "Только переменный", "Постоянный или переменный", "Высокочастотный"],
        correct: 2 },
      { id: "w2", text: "Что определяет марка электрода УОНИ 13/55?",
        options: ["Диаметр электрода", "Прочность наплавленного металла (55 кгс/мм²)", "Тип покрытия", "Длину электрода"],
        correct: 1 },
      { id: "w3", text: "Минимальное расстояние от места сварки до огнеопасных материалов (нормы РК):",
        options: ["1 м", "3 м", "5 м", "10 м"],
        correct: 2 },
      { id: "w4", text: "При сварке нержавеющей стали используют:",
        options: ["МА-11", "АНО-4", "ОК 61.30 (для нержавейки)", "УОНИ 13/55"],
        correct: 2 },
      { id: "w5", text: "Что такое «прихватка» в сварке?",
        options: ["Дефект шва", "Короткий шов для фиксации деталей перед сваркой", "Зазор между деталями", "Марка сварочного аппарата"],
        correct: 1 },
    ],
  },
  concrete: {
    id: "concrete",
    title: "Бетонщик",
    description: "Знание работы с бетонными смесями и опалубкой",
    passingScore: 70,
    questions: [
      { id: "c1", text: "Водоцементное отношение (В/Ц) в/c=0.5 означает:",
        options: ["На 1 кг цемента — 0.5 кг воды", "На 1 кг воды — 0.5 кг цемента", "50% воды, 50% цемента по объёму", "Марку бетона B25"],
        correct: 0 },
      { id: "c2", text: "Класс прочности B25 соответствует марке:",
        options: ["М150", "М200", "М300", "М400"],
        correct: 2 },
      { id: "c3", text: "Минимальная температура укладки бетона без специальных мер (СП РК):",
        options: ["+5°C", "0°C", "+10°C", "-5°C"],
        correct: 0 },
      { id: "c4", text: "Зачем вибрировать бетон при укладке?",
        options: ["Ускорить твердение", "Удалить воздушные пузыри и уплотнить смесь", "Добавить воду", "Снизить температуру"],
        correct: 1 },
      { id: "c5", text: "Срок опалубки для несущих плит перекрытий (распалубка) при нормальной температуре:",
        options: ["1-2 суток", "3-5 суток", "14-28 суток", "Немедленно после укладки"],
        correct: 2 },
    ],
  },
  electrician: {
    id: "electrician",
    title: "Электромонтажник",
    description: "Основы электромонтажных работ и техника безопасности",
    passingScore: 70,
    questions: [
      { id: "e1", text: "Допустимое напряжение для ручного электроинструмента в сырых помещениях (ПУЭ):",
        options: ["220 В", "42 В", "127 В", "380 В"],
        correct: 1 },
      { id: "e2", text: "Сечение провода ВВГнг 3×2.5 мм² используется для:",
        options: ["Силовых цепей до 5 кВт при постоянной нагрузке", "Сигнальных цепей", "Только для наружной прокладки", "Освещения в промышленных зданиях"],
        correct: 0 },
      { id: "e3", text: "Группа по электробезопасности III позволяет:",
        options: ["Только наблюдать за работой", "Единолично обслуживать установки до 1000 В", "Работу в установках выше 1000 В", "Не требуется для монтажников"],
        correct: 1 },
      { id: "e4", text: "Что обозначает маркировка «PE» на клемме?",
        options: ["Фазный провод", "Нейтраль (ноль)", "Защитное заземление", "Аварийный стоп"],
        correct: 2 },
      { id: "e5", text: "Порядок действий при поражении коллеги электрическим током:",
        options: ["Схватить пострадавшего и оттащить", "Отключить питание, вызвать помощь, начать СЛР если нет пульса", "Облить водой", "Ждать скорую не предпринимая ничего"],
        correct: 1 },
    ],
  },
};

// GET /api/build/skill-tests — list available tests (public)
skillBadgesRouter.get("/skill-tests", (_req, res) => {
  return ok(res, {
    tests: Object.values(TESTS).map(({ id, title, description, passingScore, questions }) => ({
      id, title, description, passingScore, questionCount: questions.length,
    })),
  });
});

// GET /api/build/skill-tests/:id — get test with questions (options only, no correct)
skillBadgesRouter.get("/skill-tests/:id", (req, res) => {
  const test = TESTS[req.params.id];
  if (!test) return fail(res, 404, "test_not_found");
  return ok(res, {
    test: {
      id: test.id, title: test.title, description: test.description,
      passingScore: test.passingScore,
      questions: test.questions.map(({ id, text, options }) => ({ id, text, options })),
    },
  });
});

// POST /api/build/skill-tests/:id/submit — grade answers, award badge if passed
skillBadgesRouter.post("/skill-tests/:id/submit", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const test = TESTS[req.params.id];
    if (!test) return fail(res, 404, "test_not_found");

    const answers = req.body?.answers;
    if (!Array.isArray(answers) || answers.length !== test.questions.length) {
      return fail(res, 400, `answers must be array of ${test.questions.length} integers`);
    }

    let correct = 0;
    const feedback = test.questions.map((q, i) => {
      const chosen = Number(answers[i]);
      const isCorrect = chosen === q.correct;
      if (isCorrect) correct++;
      return { questionId: q.id, chosen, correct: q.correct, isCorrect };
    });

    const score = Math.round((correct / test.questions.length) * 100);
    const passed = score >= test.passingScore;

    if (passed) {
      await pool.query(
        `INSERT INTO "BuildSkillBadge" ("userId","testId","score","passed")
         VALUES ($1,$2,$3,true)
         ON CONFLICT ("userId","testId") DO UPDATE
           SET "score" = GREATEST("BuildSkillBadge"."score", EXCLUDED."score"),
               "grantedAt" = NOW()
         RETURNING "id","grantedAt"`,
        [auth.sub, test.id, score],
      );
    }

    return ok(res, { score, passed, passingScore: test.passingScore, correct, total: test.questions.length, feedback });
  } catch (err: unknown) {
    return fail(res, 500, "submit_failed");
  }
});

// GET /api/build/skill-badges/me — my badges (auth)
skillBadgesRouter.get("/skill-badges/me", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await ensureTable();

    const rows = await pool.query(
      `SELECT "id","testId","score","passed","grantedAt"
       FROM "BuildSkillBadge" WHERE "userId"=$1 ORDER BY "grantedAt" DESC`,
      [auth.sub],
    );
    const badges = rows.rows.map((r: { testId: string; id: string; score: number; passed: boolean; grantedAt: string }) => ({
      ...r,
      testTitle: TESTS[r.testId]?.title ?? r.testId,
    }));
    return ok(res, { badges });
  } catch (err: unknown) {
    return fail(res, 500, "get_badges_failed");
  }
});

// GET /api/build/skill-badges/user/:userId — public badges
skillBadgesRouter.get("/skill-badges/user/:userId", async (req, res) => {
  try {
    await ensureTable();
    const rows = await pool.query(
      `SELECT "id","testId","score","grantedAt"
       FROM "BuildSkillBadge" WHERE "userId"=$1 AND "passed"=true ORDER BY "grantedAt" DESC`,
      [req.params.userId],
    );
    const badges = rows.rows.map((r: { testId: string; id: string; score: number; grantedAt: string }) => ({
      ...r,
      testTitle: TESTS[r.testId]?.title ?? r.testId,
    }));
    return ok(res, { badges });
  } catch (err: unknown) {
    return fail(res, 500, "get_badges_failed");
  }
});
