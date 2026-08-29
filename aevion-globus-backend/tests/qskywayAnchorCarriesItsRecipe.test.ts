import { describe, test, expect } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";
import { anchorRecipe } from "../src/routes/qskyway.airspace.anchor";

/**
 * Доказательство привязки уходит вместе с инструкцией — и с честной границей.
 *
 * ПОВОД (29.08.2026). Ответ нёс `otsProofB64` и `contentHash` и НИ СЛОВА о
 * том, что с ними делать. Биткоин-штамп существует ради ТРЕТЬЕЙ стороны;
 * отдать его без инструкции — то же, что отдать подпись без ключа.
 *
 * И вторая половина: штамп доказывает, что редакция СУЩЕСТВОВАЛА к моменту,
 * и ничего не говорит о её правильности. Без этой оговорки «привязано к
 * Bitcoin» читается как «проверено Bitcoin», и заявление становится сильнее
 * продукта.
 */
function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/qskyway", qskywayRouter);
  return a;
}

describe("привязка объясняет, как её проверить", () => {
  test("ответ несёт рецепт с шагами на двух языках", async () => {
    const res = await request(app()).post("/api/qskyway/airspace/anchor").send({ city: "nyc" });
    expect(res.status).toBe(200);
    const v = res.body.verifyYourself;
    expect(v, "рецепта в ответе нет — доказательство уходит без инструкции").toBeTruthy();
    expect(Array.isArray(v.steps) && v.steps.length >= 3).toBe(true);
    expect(Array.isArray(v.stepsEn) && v.stepsEn.length === v.steps.length).toBe(true);
  });

  test("рецепт называет ГРАНИЦУ: существование, а не правильность", async () => {
    const res = await request(app()).post("/api/qskyway/airspace/anchor").send({ city: "nyc" });
    const v = res.body.verifyYourself;
    expect(String(v.limit).toLowerCase()).toContain("существовала");
    expect(String(v.limitEn).toLowerCase()).toContain("existed");
    // И прямо говорит, чего НЕ доказывает.
    expect(String(v.limit).toLowerCase()).toContain("ничего не говорит");
    expect(String(v.limitEn).toLowerCase()).toContain("nothing about");
  });

  test("шаги ведут к байтам, а не в никуда", async () => {
    const res = await request(app()).post("/api/qskyway/airspace/anchor").send({ city: "nyc" });
    const joined = res.body.verifyYourself.steps.join(" ");
    // Инструкция обязана назвать, ГДЕ взять то, из чего считается хэш.
    expect(joined).toContain("/airspace/edition");
    expect(joined).toContain("sha256");
  });

  test("оба ответа об одном доказательстве несут ОДИН рецепт", async () => {
    // У nyc доказательство уже готово, и ответ идёт по ветке повторного
    // использования. Если бы рецепт был только у свежей привязки, инструкция
    // зависела бы от того, КОГДА спросили.
    const res = await request(app()).post("/api/qskyway/airspace/anchor").send({ city: "nyc" });
    expect(res.body.verifyYourself).toEqual(anchorRecipe("nyc"));
  });

  test("рецепт называет именно тот город, о котором спросили", () => {
    expect(anchorRecipe("nyc").steps.join(" ")).toContain("city=nyc");
    expect(anchorRecipe("astana").steps.join(" ")).toContain("city=astana");
  });
});
