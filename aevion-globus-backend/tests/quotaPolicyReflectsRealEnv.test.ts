import { describe, test, expect, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: ручка «применяются ли лимиты токенов» отражает НАСТОЯЩЕЕ окружение.
 *
 * ЗАЧЕМ. Этой ручкой пользуются как ПРИБОРОМ. 01.09.2026 я на её ответе
 * построил утверждение основателю о деньгах: «объявленные лимиты платных
 * тарифов на проде не применяются». Замер в тот же день: мутация «отвечать
 * всегда применяются» НЕ ловилась ни одним из 70 файлов, где упоминаются
 * quota или qcore.
 *
 * Опасное направление — именно ложное «применяются»: тогда мы считаем
 * покупателей ограниченными, а платим за перерасход сами.
 *
 * Значения переменных НЕ печатаются: проверяется только соответствие.
 */
const ФЛАГИ = {
  tierQuotaEnforced: "QCOREAI_TIER_QUOTA",
  premiumQuotaEnforced: "QCOREAI_PREMIUM_QUOTA",
  // Третий флаг того же вида. Именно он был КОНТРОЛЕМ, когда я делал
  // вывод о деньгах («бесплатные ограничены — значит механизм жив»),
  // и при этом сам не проверялся ничем.
  freeQuotaEnforced: "QCOREAI_FREE_QUOTA",
} as const;

const { qcoreaiRouter } = await import("../src/routes/qcoreai");

function приложение() {
  const a = express();
  a.use(express.json());
  // Роутер монтируется БЕЗ requireModule: платная стена здесь не предмет
  // проверки, а её присутствие сделало бы ответ 402 и скрыло бы поля.
  a.use("/api/qcoreai", qcoreaiRouter);
  return a;
}

const сохранено: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const п of Object.values(ФЛАГИ)) сохранено[п] = process.env[п];
});
afterAll(() => {
  for (const [п, з] of Object.entries(сохранено)) {
    if (з === undefined) delete process.env[п];
    else process.env[п] = з;
  }
});

async function политика() {
  const res = await request(приложение()).get("/api/qcoreai/quota-policy");
  expect(res.status).toBe(200);
  return res.body as Record<string, unknown>;
}

describe("состояние лимитов совпадает с окружением", () => {
  test("КОНТРОЛЬ: ручка вообще отдаёт эти поля", async () => {
    const п = await политика();
    for (const поле of Object.keys(ФЛАГИ)) {
      expect(п, `поля ${поле} нет — проверять нечего`).toHaveProperty(поле);
    }
  });

  test("КОНТРОЛЬ ОХВАТА: у каждого поля *QuotaEnforced есть строка в карте", async () => {
    // Карта написана рукой, а полей со временем становится больше.
    // Без этой проверки четвёртый лимит остался бы вне охвата МОЛЧА —
    // так из первой версии выпал freeQuotaEnforced.
    const п = await политика();
    const вне = Object.keys(п).filter(
      (k) => k.endsWith("QuotaEnforced") && !(k in ФЛАГИ)
    );
    expect(вне, "поле есть в ответе, но не проверяется этим сторожем").toEqual([]);
  });

  test("флаг НЕ выставлен — ручка НЕ говорит «применяется»", async () => {
    for (const п of Object.values(ФЛАГИ)) delete process.env[п];
    const п = await политика();
    const соврала = Object.keys(ФЛАГИ).filter((поле) => п[поле] === true);
    expect(соврала, "лимит не включён, а ручка объявляет его применяемым").toEqual([]);
  });

  test("флаг выставлен — ручка говорит «применяется»", async () => {
    // Вторая половина пары: без неё проверка проходила бы и на коде,
    // который отвечает «не применяется» ВСЕГДА.
    for (const п of Object.values(ФЛАГИ)) process.env[п] = "1";
    const п = await политика();
    const промолчала = Object.keys(ФЛАГИ).filter((поле) => п[поле] !== true);
    expect(промолчала, "лимит включён, а ручка этого не показывает").toEqual([]);
  });

  test("значение, отличное от «1», включением НЕ считается", async () => {
    // Иначе "0", "false" или "off" читались бы как «включено», и ручка
    // объявляла бы защиту там, где её нет.
    for (const п of Object.values(ФЛАГИ)) process.env[п] = "0";
    const п = await политика();
    const соврала = Object.keys(ФЛАГИ).filter((поле) => п[поле] === true);
    expect(соврала, "значение «0» принято за включение").toEqual([]);
  });
});
