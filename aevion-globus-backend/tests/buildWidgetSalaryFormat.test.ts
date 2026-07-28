import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { publicRouter } from "../src/routes/build/public";
import { DEFAULT_SALARY_CURRENCY } from "../src/lib/build";

/**
 * Виджет вакансий на ЧУЖИХ сайтах не должен врать о валюте зарплаты.
 *
 * Найдено 28.07 и подтверждено живым прод-запросом к
 * `/api/build/public/widget.js`: форматирование выглядело так —
 *
 *     return "$"+n+" "+(v.salaryCurrency||"USD");
 *
 * Знак доллара приклеен НЕЗАВИСИМО от валюты, код валюты приписан после. Для
 * рублёвой вакансии это давало «$4,500 RUB»: при быстром взгляде читается как
 * четыре с половиной тысячи долларов, то есть завышение примерно в 90 раз. И это
 * не наша страница, а виджет, который партнёр ставит у себя, — то есть неверная
 * цифра оказывается на чужом сайте под нашим именем.
 *
 * Заодно фиксируется вторая половина той же истории: пустая валюта здесь
 * подставлялась как «USD», тогда как путь записи вакансии подставляет
 * DEFAULT_SALARY_CURRENCY. Одно и то же пустое поле означало разное в записи и в
 * показе — см. комментарий у самой константы.
 *
 * Тест ИСПОЛНЯЕТ отданную браузеру функцию, а не читает её регуляркой: виджет
 * отдаётся строкой внутри шаблонного литерала, и проверять надо результат, а не
 * исходник. Совпадение подстроки сказало бы лишь то, что текст изменился.
 */

async function servedFmtSalary(): Promise<(v: unknown) => string> {
  const app = express();
  app.use("/api/build/public", publicRouter);
  const res = await request(app).get("/api/build/public/widget.js");
  expect(res.status).toBe(200);
  const sym = res.text.match(/var SYM = \{[^}]*\}/)?.[0];
  const body = res.text.match(/function fmtSalary\(v\)\{[\s\S]*?\n {2}\}/)?.[0];
  expect(sym, "в отданном виджете не нашлась таблица знаков валют").toBeTruthy();
  expect(body, "в отданном виджете не нашлась функция fmtSalary").toBeTruthy();
  return new Function(`${sym}; ${body}; return fmtSalary;`)() as (v: unknown) => string;
}

describe("виджет вакансий: формат зарплаты", () => {
  it("рубли не показываются со знаком доллара", async () => {
    const fmt = await servedFmtSalary();
    const out = fmt({ salary: 4500, salaryCurrency: "RUB" });
    expect(out).not.toContain("$");
    expect(out).toContain("4,500");
    expect(out).toContain("₽"); // ₽
  });

  it("каждая известная валюта получает свой знак", async () => {
    const fmt = await servedFmtSalary();
    expect(fmt({ salary: 100, salaryCurrency: "USD" })).toBe("$100");
    expect(fmt({ salary: 100, salaryCurrency: "EUR" })).toBe("€100");
    expect(fmt({ salary: 100, salaryCurrency: "KZT" })).toBe("₸100");
  });

  it("неизвестная валюта показывается КОДОМ, а не чужим знаком", async () => {
    // Подставить произвольный знак — тот же дефект, что был с долларом.
    const fmt = await servedFmtSalary();
    expect(fmt({ salary: 100, salaryCurrency: "XYZ" })).toBe("100 XYZ");
  });

  it("пустая валюта трактуется так же, как при записи вакансии", async () => {
    // Иначе показ и запись снова начнут означать разное.
    const fmt = await servedFmtSalary();
    const empty = fmt({ salary: 100, salaryCurrency: null });
    const explicit = fmt({ salary: 100, salaryCurrency: DEFAULT_SALARY_CURRENCY });
    expect(empty).toBe(explicit);
  });

  it("регистр валюты не влияет на знак", async () => {
    const fmt = await servedFmtSalary();
    expect(fmt({ salary: 100, salaryCurrency: "rub" })).toBe(fmt({ salary: 100, salaryCurrency: "RUB" }));
  });

  it("не указанная зарплата остаётся пустой строкой", async () => {
    // Поведение до правки; проверяется, чтобы правка формата его не задела.
    const fmt = await servedFmtSalary();
    expect(fmt({ salary: 0, salaryCurrency: "RUB" })).toBe("");
    expect(fmt(null)).toBe("");
  });
});
