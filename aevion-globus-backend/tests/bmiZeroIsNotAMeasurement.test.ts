import { describe, test, expect, vi } from "vitest";
import { stripComments } from "./helpers/sourceCode";
import express from "express";
import request from "supertest";

/**
 * Ноль в поле показателя здоровья — не «неизвестно», а число.
 *
 * `POST /api/healthai/profile` с пустым телом создаёт профиль, где рост и вес
 * равны нулю (у каждого поля стоит умолчание `Number(body.x) || 0`), и рядом
 * уезжает `bmi: 0`.
 *
 * Витрина к правде БЫЛА готова заранее: `healthai/plan` объявляет
 * `bmi: number | null` и рисует значение только при `!== null`. То есть договор
 * был на «неизвестно», а бэкенд слал ноль — и страница честно печатала «0.0».
 *
 * Признак недосмотра, а не решения: в этом же файле ручка `population` уже
 * превращала 0 в null для ответа. Один автор, один файл, разное поведение.
 *
 * Внутри расчёта рисков 0 тоже трактовался как «неизвестно», но только в двух
 * ветках из четырёх (`bmiVal > 0 && bmiVal < 18.5`). Остальные держались на
 * арифметике: 0 просто не проходит `>= 27`. Работало — и разваливалось бы от
 * любой правки порогов. Теперь проверка явная.
 */

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [], rowCount: 0 }) }),
  isDbConfigured: () => false,
}));

const { healthaiRouter } = await import("../src/routes/healthai");

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/healthai", healthaiRouter);
  return a;
}

describe("ИМТ не выдумывается из нулей", () => {
  test("пустое тело: bmi null, а не 0", async () => {
    const res = await request(app()).post("/api/healthai/profile").send({});
    expect(res.status).toBe(200);
    expect(res.body.bmi, "ноль читается как показатель").not.toBe(0);
    expect(res.body.bmi).toBeNull();
  });

  test("рост есть, веса нет — тоже null", async () => {
    // Прежняя проверка смотрела только на рост: 170 см при весе 0 давало 0.
    const res = await request(app())
      .post("/api/healthai/profile")
      .send({ heightCm: 170, memberLabel: "без веса" });
    expect(res.body.profile.heightCm).toBe(170);
    expect(res.body.profile.weightKg).toBe(0);
    expect(res.body.bmi, "вес не проверялся").toBeNull();
  });

  test("контроль: полные данные дают настоящее число", async () => {
    const res = await request(app())
      .post("/api/healthai/profile")
      .send({ heightCm: 180, weightKg: 81, age: 40, sex: "M" });
    expect(res.body.bmi).toBeCloseTo(25, 0);
  });

  test("контроль: витрина ждёт именно number | null", () => {
    // Договор на стороне страницы: healthai/plan объявляет bmi: number | null
    // и рисует его только при !== null. Тест держит обе стороны вместе, иначе
    // «починка» бэкенда снова разойдётся с экраном.
    // Без stripComments сторож зеленеет на ЗАКОММЕНТИРОВАННОМ договоре:
    // проверено мутацией 21.08.2026 — закомментировал строку, тест не заметил.
    const src = stripComments(
      require("node:fs").readFileSync(
        require("node:path").join(__dirname, "..", "..", "frontend", "src", "app", "healthai", "plan", "page.tsx"),
        "utf8",
      ),
    );
    expect(src).toMatch(/bmi:\s*number\s*\|\s*null/);
    expect(src).toMatch(/bmi\s*!==\s*null/);
  });
});
