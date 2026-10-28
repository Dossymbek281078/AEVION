import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ключОшибки } from "../oshibka";
import { tPsy, PSY_KEYS, PSY_DICT, AFFIRMATIONS, dayKey } from "../../i18n";

/*
 * 28.10.2026 (окно «Приложения-2»). Коды ниже — дословно из ответов прода 7b16f03ce на неверный ввод
 * (проба curl 28.10: 10 из 10 ответили 400/404). Человек не должен видеть их сырыми — ни на ru, ни на en/kk.
 */
const КОДЫ_ПРОДА = [
  "alias must be 2..40 chars [a-z0-9_-]",
  "alias invalid (2..40 chars [a-z0-9_-])",
  "alias invalid",
  "alias_owned_by_another_user",
  "user_not_found",
  "addiction must be one of: alcohol, smoking, other",
  "trigger_type must be one of: craving, stress, social, emotion",
  "intensity_1_10 must be 1..10",
  "message required",
  "invalid_json",
];
const ПАПКА = join(process.cwd(), "src/app/psyapp-deps");
const КОМПОНЕНТЫ = ["Onboarding.tsx", "StreakCounter.tsx", "SupportChat.tsx", "TriggerLog.tsx", "Affirmation.tsx"];

describe("PsyApp: ошибки сервера человеческим текстом", () => {
  test.each(КОДЫ_ПРОДА)("«%s» → свой ключ err.*, не запасной", (код) => {
    expect(ключОшибки(код, "onb.fail")).toMatch(/^err\./);
  });

  test("неизвестный код и пустота → запасной ключ места", () => {
    expect(ключОшибки("internal error", "trig.fail")).toBe("trig.fail");
    expect(ключОшибки(undefined, "trig.fail")).toBe("trig.fail");
    expect(ключОшибки({ x: 1 }, "chat.unavailable")).toBe("chat.unavailable");
  });

  test("🔴 компоненты не показывают d.error и e.message сырыми; сбой загрузки журнала не выглядит пустым журналом", () => {
    for (const ф of КОМПОНЕНТЫ.slice(0, 4)) {
      const s = readFileSync(join(ПАПКА, "components", ф), "utf8");
      expect(s, ф).not.toMatch(/setError\(d\.error/);
      expect(s, ф).not.toMatch(/\.message : /);
      expect(s, ф).toContain('setError(t("err.offline"))');
    }
    const t = readFileSync(join(ПАПКА, "components/TriggerLog.tsx"), "utf8");
    expect(t).not.toMatch(/\/\/ silent/);
    expect(t.indexOf("loadFailed && triggers.length === 0")).toBeGreaterThan(0);
    expect(t.indexOf("loadFailed && triggers.length === 0")).toBeLessThan(t.indexOf('t("trig.empty")'));
  });
});

describe("PsyApp: ru/en/kk", () => {
  test("у всех трёх языков все ключи непустые; en и kk не совпадают с ru", () => {
    for (const lang of ["ru", "en", "kk"]) for (const k of PSY_KEYS) expect(PSY_DICT[lang]![k].trim(), `${lang}:${k}`).not.toBe("");
    const одинаковых = (lang: string) => PSY_KEYS.filter((k) => PSY_DICT[lang]![k] === PSY_DICT.ru![k] && /[а-яё]/i.test(PSY_DICT.ru![k]));
    expect(одинаковых("en")).toEqual([]);
    // kk пишется кириллицей; совпадения допустимы только для слов, общих с русским
    expect(одинаковых("kk").filter((k) => !["onb.alcohol", "trig.stress", "trig.emotion"].includes(k))).toEqual([]);
  });

  test("подстановки: число дней и склонение", () => {
    expect(tPsy("ru", "streak.inARow", { days: tPsy("ru", dayKey("ru", 21)) })).toBe("день подряд");
    expect(tPsy("ru", dayKey("ru", 3))).toBe("дня");
    expect(tPsy("ru", dayKey("ru", 11))).toBe("дней");
    expect(tPsy("en", dayKey("en", 1))).toBe("day");
    expect(tPsy("en", "streak.restarts", { n: 2 })).toBe("Restarts: 2 — that's part of the path.");
  });

  test("аффирмации: en и kk — по 10, сервер отдаёт только ru", () => {
    expect(AFFIRMATIONS.en).toHaveLength(10);
    expect(AFFIRMATIONS.kk).toHaveLength(10);
    expect(AFFIRMATIONS.ru).toBeUndefined();
  });

  test("🔴 на экране нет русского текста мимо словаря (JSX-текст, подписи, placeholder, aria-label, title)", () => {
    for (const ф of [...КОМПОНЕНТЫ.map((к) => `components/${к}`), "page.tsx"]) {
      const s = readFileSync(join(ПАПКА, ф), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      const плохие = s.split("\n").filter((l) =>
        />[^<{}]*[А-Яа-яЁё][^<{}]*</.test(l) ||
        /(placeholder|aria-label|title|label|hint)[=:]\s*"[^"]*[А-Яа-яЁё]/.test(l) ||
        /^\s*[^<>{}=:/*]*[А-Яа-яЁё]{3,}[^<>{}=:]*$/.test(l) && !/[a-zA-Z_]+[А-Яа-яЁё]|[А-Яа-яЁё]+[A-Z_(]|ключОшибки|местные|ТИПЫ/.test(l),
      );
      expect(плохие, ф).toEqual([]);
    }
  });

  test("🔴 layout и og не обещают того, чего нет (ML-детекция, группы, эскалация к специалисту)", () => {
    for (const ф of ["layout.tsx", "opengraph-image.tsx"]) {
      const s = readFileSync(join(ПАПКА, ф), "utf8").replace(/^\s*\/\/.*$/gm, "");
      expect(s, ф).not.toMatch(/ML trigger|trigger-детек|групп[ыа] поддержки|group support|escalation|эскалац|early-warning|Bridge → QGood/i);
    }
  });
});
