import { Router } from "express";
import crypto from "crypto";
import { buildPool as pool, ok, fail, requireBuildAuth, safeParseJson } from "../../lib/build";

export const skillBadgesRouter = Router();

// Built-in construction skill tests. Seeded on first request.
const BUILTIN_TESTS = [
  {
    skill: "welding",
    title: "Сварка (базовый)",
    description: "10 вопросов о сварочных процессах MIG/MAG/TIG и дефектах сварных швов.",
    passMark: 70,
    questions: [
      { q: "Какой газ используется при сварке TIG?", options: ["Аргон", "Углекислота", "Азот", "Кислород"], correct: 0 },
      { q: "Что такое «прожог» в сварке?", options: ["Сквозное отверстие в шве", "Трещина шва", "Пористость", "Подрез"], correct: 0 },
      { q: "Минимальная температура предварительного подогрева для стали 09Г2С?", options: ["0°C", "50°C", "100°C", "200°C"], correct: 0 },
      { q: "Что означает маркировка электрода УОНИ-13/55?", options: ["Основное покрытие, σв≥550МПа", "Рутиловое, 55°", "Кислое, 55мм", "Целлюлозное"], correct: 0 },
      { q: "Какой дефект образуется при завышенной скорости сварки?", options: ["Подрез", "Наплыв", "Прожог", "Пористость"], correct: 0 },
      { q: "Для чего служит обратный полярность при сварке покрытым электродом?", options: ["Меньший нагрев металла", "Более глубокое проплавление", "Снижение пористости", "Нет разницы"], correct: 1 },
      { q: "Что проверяет ультразвуковой контроль?", options: ["Внутренние дефекты", "Цвет шва", "Твёрдость", "Ширину шва"], correct: 0 },
      { q: "Нормальный угол разделки кромок при стыковом шве?", options: ["60-70°", "30-40°", "90°", "10-20°"], correct: 0 },
      { q: "Какой ток при сварке порошковой проволокой?", options: ["Постоянный обратной полярности", "Переменный", "Постоянный прямой", "Любой"], correct: 0 },
      { q: "Расстояние между прихватками при сборке стыка?", options: ["200-300 мм", "50 мм", "500 мм", "Любое"], correct: 0 },
    ],
  },
  {
    skill: "concrete",
    title: "Бетонные работы",
    description: "10 вопросов о бетонировании, армировании и уходе за бетоном.",
    passMark: 70,
    questions: [
      { q: "Марка бетона B25 соответствует классу прочности:", options: ["М350", "М200", "М100", "М500"], correct: 0 },
      { q: "Минимальный защитный слой арматуры в фундаменте:", options: ["40 мм", "10 мм", "20 мм", "60 мм"], correct: 0 },
      { q: "Что такое водоцементное отношение?", options: ["W/C — отношение воды к цементу", "Объём воды", "Класс цемента", "Марка щебня"], correct: 0 },
      { q: "При какой температуре нельзя укладывать бетон без прогрева?", options: ["Ниже 0°C", "Ниже +5°C", "Выше +30°C", "Разницы нет"], correct: 0 },
      { q: "Для чего используют вибратор при бетонировании?", options: ["Удаление воздуха и уплотнение", "Нагрев смеси", "Ускорение схватывания", "Промывка опалубки"], correct: 0 },
      { q: "Класс арматуры для фундаментов в сейсмозонах:", options: ["А500С", "А240", "Вр-1", "А400"], correct: 0 },
      { q: "Через сколько дней бетон набирает 70% прочности при +20°C?", options: ["7 суток", "1 сутки", "28 суток", "3 месяца"], correct: 0 },
      { q: "Что такое «пластичность» бетонной смеси?", options: ["Удобоукладываемость (ОК)", "Прочность", "Морозостойкость", "Водонепроницаемость"], correct: 0 },
      { q: "Минимальный диаметр рабочей арматуры в плите:", options: ["10 мм", "4 мм", "20 мм", "32 мм"], correct: 0 },
      { q: "При +5°C время набора прочности:", options: ["Увеличивается в 2-3 раза", "Не изменяется", "Уменьшается", "Бетон не твердеет"], correct: 0 },
    ],
  },
  {
    skill: "electrician",
    title: "Электромонтаж (базовый)",
    description: "10 вопросов по ПУЭ, безопасности и электромонтажным работам.",
    passMark: 70,
    questions: [
      { q: "Минимальное сечение провода для розеточной группы 16А:", options: ["2.5 мм²", "1.5 мм²", "4 мм²", "0.75 мм²"], correct: 0 },
      { q: "Что означает IP54?", options: ["Пылезащита 5, защита от брызг 4", "Ток 5A, мощность 4кВт", "Класс 5, группа 4", "Вольтаж 54В"], correct: 0 },
      { q: "Безопасное напряжение в помещениях с повышенной опасностью:", options: ["42 В", "220 В", "110 В", "12 В"], correct: 0 },
      { q: "Цвет провода защитного заземления (PE):", options: ["Жёлто-зелёный", "Синий", "Красный", "Белый"], correct: 0 },
      { q: "Что такое УЗО?", options: ["Устройство защитного отключения", "Усиленное защитное ограждение", "Узел заземляющего оборудования", "Ультра-звуковой ограничитель"], correct: 0 },
      { q: "Минимальное расстояние от розетки до душевой кабины:", options: ["60 см", "10 см", "2 м", "Нет ограничений"], correct: 2 },
      { q: "Что проверяет мегаомметр?", options: ["Сопротивление изоляции", "Ток", "Напряжение", "Частоту"], correct: 0 },
      { q: "Номинал автомата для электроплиты 7кВт при 220В:", options: ["32 А", "10 А", "63 А", "16 А"], correct: 0 },
      { q: "Группа по электробезопасности для самостоятельной работы:", options: ["III", "I", "II", "IV"], correct: 0 },
      { q: "Расстояние между крепежами кабеля на горизонтальном участке:", options: ["350 мм", "100 мм", "1000 мм", "50 мм"], correct: 0 },
    ],
  },
];

async function seedTests(): Promise<void> {
  for (const test of BUILTIN_TESTS) {
    await pool.query(
      `INSERT INTO "BuildSkillTest" ("id","skill","title","description","questionsJson","passMark","active")
       VALUES ($1,$2,$3,$4,$5,$6,TRUE)
       ON CONFLICT ("skill") DO NOTHING`,
      [crypto.randomUUID(), test.skill, test.title, test.description, JSON.stringify(test.questions), test.passMark],
    );
  }
}

// GET /api/build/skill-badges/tests — list available tests
skillBadgesRouter.get("/tests", async (_req, res) => {
  try {
    await seedTests();
    const r = await pool.query(
      `SELECT "id","skill","title","description","passMark" FROM "BuildSkillTest" WHERE "active" = TRUE ORDER BY "skill"`,
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "tests_list_failed", { details: (err as Error).message });
  }
});

// GET /api/build/skill-badges/tests/:skill — get test questions (shuffled, no correct answers)
skillBadgesRouter.get("/tests/:skill", async (req, res) => {
  try {
    await seedTests();
    const skill = String(req.params.skill);
    const r = await pool.query(`SELECT * FROM "BuildSkillTest" WHERE "skill" = $1 AND "active" = TRUE LIMIT 1`, [skill]);
    if (r.rowCount === 0) return fail(res, 404, "test_not_found");
    const test = r.rows[0];
    const questions: Array<{ q: string; options: string[] }> = safeParseJson(test.questionsJson, []);
    // Return questions without correct answers
    const sanitized = questions.map((q) => ({ q: q.q, options: q.options }));
    return ok(res, {
      id: test.id,
      skill: test.skill,
      title: test.title,
      description: test.description,
      passMark: test.passMark,
      questions: sanitized,
    });
  } catch (err: unknown) {
    return fail(res, 500, "test_fetch_failed", { details: (err as Error).message });
  }
});

// POST /api/build/skill-badges/tests/:skill/submit — submit answers, get badge if passed
skillBadgesRouter.post("/tests/:skill/submit", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    await seedTests();

    const skill = String(req.params.skill);
    const r = await pool.query(`SELECT * FROM "BuildSkillTest" WHERE "skill" = $1 AND "active" = TRUE LIMIT 1`, [skill]);
    if (r.rowCount === 0) return fail(res, 404, "test_not_found");
    const test = r.rows[0];
    const questions: Array<{ q: string; options: string[]; correct: number }> = safeParseJson(test.questionsJson, []);

    const answers = Array.isArray(req.body?.answers) ? req.body.answers as number[] : [];
    if (answers.length !== questions.length) return fail(res, 400, "wrong_answer_count");

    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correct) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= test.passMark;

    if (passed) {
      await pool.query(
        `INSERT INTO "BuildSkillBadge" ("id","userId","skill","score")
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("userId","skill") DO UPDATE SET "score" = GREATEST("BuildSkillBadge"."score", $4), "earnedAt" = NOW()`,
        [crypto.randomUUID(), auth.sub, skill, score],
      );
    }

    return ok(res, {
      score,
      passed,
      correct,
      total: questions.length,
      passMark: test.passMark,
      badge: passed ? { skill, score } : null,
    });
  } catch (err: unknown) {
    return fail(res, 500, "test_submit_failed", { details: (err as Error).message });
  }
});

// GET /api/build/skill-badges/user/:id — badges for a user profile
skillBadgesRouter.get("/user/:id", async (req, res) => {
  try {
    const userId = String(req.params.id);
    const r = await pool.query(
      `SELECT sb."skill", sb."score", sb."earnedAt", st."title"
       FROM "BuildSkillBadge" sb
       LEFT JOIN "BuildSkillTest" st ON st."skill" = sb."skill"
       WHERE sb."userId" = $1 ORDER BY sb."earnedAt" DESC`,
      [userId],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "badges_user_failed", { details: (err as Error).message });
  }
});

// GET /api/build/skill-badges/my — auth caller's own badges
skillBadgesRouter.get("/my", async (req, res) => {
  try {
    const auth = requireBuildAuth(req, res);
    if (!auth) return;
    const r = await pool.query(
      `SELECT sb."skill", sb."score", sb."earnedAt", st."title"
       FROM "BuildSkillBadge" sb
       LEFT JOIN "BuildSkillTest" st ON st."skill" = sb."skill"
       WHERE sb."userId" = $1 ORDER BY sb."earnedAt" DESC`,
      [auth.sub],
    );
    return ok(res, { items: r.rows, total: r.rowCount });
  } catch (err: unknown) {
    return fail(res, 500, "badges_my_failed", { details: (err as Error).message });
  }
});
