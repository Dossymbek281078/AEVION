// Отказ агента и подсказка «повторите через…» — на языке страницы.
// Замер на проде 30.10.2026 (сайт 4f71ad70f, /en): карточка не ответившего агента и строка ошибки
// консилиума печатались по-русски — failureText.ts знал только русский, страницы звали его без языка.
// Без lang и на ru всё как раньше (тесты failureText.test.ts не тронуты).
// КОНТРОЛЬ: на 9b9d0bb6a оба случая с en красные (второй аргумент игнорировался, текст русский).
import { describe, expect, test } from "vitest";
import { agentFailure, retryHint } from "../failureText";

const кириллица = /[А-Яа-яЁё]/;
const ПРИЧИНЫ = [
  undefined,
  "rate_limit_exceeded: max 30 chat requests per minute",
  "provider_quota_exceeded",
  "empty reply from provider",
  "ETIMEDOUT",
  "unauthorized",
  "upstream 503",
  "ECONNRESET while reading socket",
];

describe("отказ агента на языке страницы", () => {
  test("en: ни одна из причин не остаётся русской, техническая строка сохраняется как есть", () => {
    for (const raw of ПРИЧИНЫ) {
      const f = agentFailure(raw, "en");
      expect(f.human, `human для «${raw}»`).not.toMatch(кириллица);
      expect(f.technical).toBe(agentFailure(raw).technical);
    }
    expect(agentFailure("rate_limit_exceeded", "en").human).toMatch(/personal count/);
    expect(agentFailure(undefined, "en").human).toBe("The agent did not answer.");
  });

  test("en: retryHint — «Try again in 12 s.» / «Try again in 2 min.»; пустое остаётся пустым", () => {
    expect(retryHint(12, "en")).toBe(" Try again in 12 s.");
    expect(retryHint(90, "en")).toBe(" Try again in 2 min.");
    expect(retryHint(undefined, "en")).toBe("");
  });

  test("ru и без lang — прежний русский текст байт в байт", () => {
    for (const raw of ПРИЧИНЫ) {
      expect(agentFailure(raw, "ru")).toEqual(agentFailure(raw));
      expect(agentFailure(raw).human).toMatch(кириллица);
    }
    expect(retryHint(12, "ru")).toBe(" Повторите через 12 с.");
    expect(retryHint(90)).toBe(" Повторите через 2 мин.");
  });

  test("kk: причина переведена (не русский исходник)", () => {
    expect(agentFailure(undefined, "kk").human).not.toBe(agentFailure(undefined).human);
    expect(retryHint(12, "kk")).not.toBe(retryHint(12));
  });
});
