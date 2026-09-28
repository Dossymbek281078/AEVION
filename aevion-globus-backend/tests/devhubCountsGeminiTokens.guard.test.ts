/**
 * Учёт расхода DevHub обязан понимать формат КАЖДОГО провайдера, а не только OpenAI.
 *
 * ЗАЧЕМ. DevHub — бесплатный магнит, на котором стоит план роста: гость без
 * входа и без карты получает сгенерированный проект. Генерацию делает
 * gemini-2.5-flash, и она стоит денег. Замер 28.09.2026 сквозным прогоном
 * гостем на ЖИВОМ проде: ответ вернул `runTokens {in: 0, out: 0}` и
 * `runCostUsd 0` — при семи реально сгенерированных файлах.
 *
 * Причина: накопитель читал только `prompt_tokens` / `completion_tokens` —
 * это имена OpenAI. Gemini присылает `usageMetadata` с `promptTokenCount` /
 * `candidatesTokenCount`, и оба поля оказывались `undefined`, то есть нулём.
 *
 * Последствие денежное, а не косметическое: расход шёл, а прибор показывал
 * ноль. На вопрос «во что обойдётся тысяча генераций в день» — а план целится
 * ровно в такой объём — ответа не было. Это тот же класс, который уже назван
 * в шапке lib/usageTokens: «multichat вообще не считал токены и показывал нули».
 *
 * Ноль от счётчика неотличим от «бесплатно», поэтому такой дефект не краснеет
 * сам и не всплывает, пока кто-нибудь не получит счёт.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { usageToTokens } from "../src/lib/usageTokens";

describe("DevHub считает расход у всех провайдеров", () => {
  it("формат Gemini не превращается в ноль", () => {
    const { tokensIn, tokensOut } = usageToTokens({
      promptTokenCount: 1234,
      candidatesTokenCount: 567,
    });
    expect(tokensIn).toBe(1234);
    expect(tokensOut).toBe(567);
  });

  it("формат OpenAI и Anthropic тоже читается", () => {
    expect(usageToTokens({ prompt_tokens: 10, completion_tokens: 20 })).toEqual({
      tokensIn: 10,
      tokensOut: 20,
    });
    expect(usageToTokens({ input_tokens: 30, output_tokens: 40 })).toEqual({
      tokensIn: 30,
      tokensOut: 40,
    });
  });

  it("отрицательный контроль: пустой и неизвестный ответ дают честный ноль", () => {
    // Иначе тест выше был бы зелёным и у прибора, который возвращает что угодно.
    expect(usageToTokens(undefined)).toEqual({ tokensIn: 0, tokensOut: 0 });
    expect(usageToTokens({ какие_то: "поля" })).toEqual({ tokensIn: 0, tokensOut: 0 });
  });

  it("devhub берёт разбор из общего дома, а не пишет свой", () => {
    /*
     * Вторая половина, и она важнее первой: сам нормализатор может быть
     * исправен, а DevHub — не звать его. Именно так и было. Проверка держится
     * за ФАКТ вызова, а не за текст комментария рядом.
     */
    const код = readFileSync(join(__dirname, "../src/routes/devhub.ts"), "utf8");
    expect(код, "devhub не импортирует общий разбор usage").toContain(
      'from "../lib/usageTokens"',
    );

    /*
     * И devhub не должен ЧИТАТЬ имена полей провайдера напрямую — ни с
     * какого имени переменной.
     *
     * Первая версия проверки была привязана к слову `usage` и мутацию НЕ
     * поймала: достаточно назвать переменную `u`, и сторож замолкал.
     * Вторая версия ловила регуляркой и тоже промахнулась — обратные слэши
     * съелись на границе вызова, из `\\s` вышло `s`, а из `\\b` —
     * невидимый BACKSPACE. Поэтому здесь регулярки нет вовсе: сравнение
     * подстрокой, ни одного экранирования.
     *
     * Ловим ЧТЕНИЕ (точка перед именем), но не СБОРКУ объекта
     * (`usage: { prompt_tokens: tin }`): собирать нормализованный usage для
     * платформенного учёта законно, а разбирать чужие формы у себя — нет.
     */
    const ИМЕНА = ["prompt_tokens", "completion_tokens", "promptTokenCount", "candidatesTokenCount"];
    const прямые = код
      .split(String.fromCharCode(10))
      .map((s, i) => ({ s: s.trim(), n: i + 1 }))
      .filter(({ s }) => !s.startsWith("//") && !s.startsWith("*"))
      .filter(({ s }) => ИМЕНА.some((имя) => s.includes("." + имя) && !s.includes(имя + ":")));
    expect(
      прямые.map((x) => x.n),
      "devhub снова разбирает форму провайдера сам — у gemini это даёт тихий ноль",
    ).toEqual([]);
  });
});
