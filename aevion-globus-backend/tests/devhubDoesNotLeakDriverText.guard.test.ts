import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Сырой текст исключения не уходит клиенту оттуда, где он может прийти от
 * драйвера базы или внешнего вызова.
 *
 * Замер 29.08.2026: в devhub.ts было 45 ответов 500, и в 22 из них наружу
 * шёл e?.message из блока, где рядом стоит pool.query, await db*, fetch()
 * или вызов провайдера. Такой текст бывает вида
 * "connect ECONNREFUSED 10.130.0.7:5432" — внутренний адрес и порт базы.
 *
 * Все 22 обёрнуты в safeErrorText, поэтому сторож требует НОЛЬ, а не
 * храповик: вечно красная проверка перестаёт читаться в первый же день.
 */
const SRC = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
const LINES = SRC.split(String.fromCharCode(10));

function risky(): string[] {
  // Условия «а есть ли рядом обращение к базе» здесь БОЛЬШЕ НЕТ, и это
  // третья редакция правила.
  //
  // Первая смотрела на 25 строк выше показа — не достала до вызова, стоявшего
  // за пятьдесят строк, и занизила класс на треть.
  // Вторая брала обработчик целиком — и всё равно промахнулась на трёх местах:
  // обращение к базе стояло ЗА помощником (getAllMonthUsage, setUserTier), в
  // теле обработчика его не видно вовсе. След теряется на границе функции, и
  // никакой статический радиус этого не чинит.
  //
  // Правильное правило проще всех предыдущих: сырой текст исключения в ответе
  // не нужен НИКОГДА. Очистка убирает адреса, роли и длину — нашим
  // собственным сообщениям она не вредит, а чужому тексту не даёт пройти.
  const out: string[] = [];
  LINES.forEach((l, i) => {
    if (l.includes("safeErrorText")) return;
    if (!l.includes("e?.message") && !l.includes("err?.message")) return;
    if (!l.includes("res.status") && !l.includes("res.json")) return;
    out.push(String(i + 1));
  });
  return out;
}

describe("текст исключения от базы и внешних вызовов не уходит клиенту", () => {
  test("прибор работает: обёрнутые места найдены", () => {
    // Без этого «нарушений нет» означало бы и «файл не прочитался», и
    // «шаблон ничего не понимает» — то есть ничего.
    const wrapped = LINES.filter((l) => l.includes("safeErrorText(")).length;
    expect(wrapped, "ни одного вызова safeErrorText — разбор не сработал").toBeGreaterThan(10);
    expect(LINES.length, "файл не прочитался").toBeGreaterThan(1000);
  });

  test("ни одного места с сырым e?.message в ответе — без исключений", () => {
    expect(
      risky(),
      "сырой текст исключения уходит клиенту: оберните в safeErrorText(e) из lib/safeErrorText",
    ).toEqual([]);
  });
});
