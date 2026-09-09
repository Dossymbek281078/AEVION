import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { HOWTO_TRANSCRIPT, howtoTranscript } from "../howtoTranscript";
import { DEVHUB_DICT } from "../i18n";

/**
 * Расшифровка обучающего видео обязана совпадать с тем, что человек услышит.
 * Иначе это не расшифровка, а второй текст рядом с роликом — и он разойдётся
 * с ним при первой же перезаписи озвучки.
 *
 * Русские строки взяты из манифеста сценария (поле vo_line), английские —
 * перевод тех же двенадцати. Сторож держит СВЯЗЬ: одинаковое число строк,
 * непустые, встроены на страницу и подпись заведена во всех языках витрины.
 */
const PAGE = fs.readFileSync(path.resolve(__dirname, "..", "page.tsx"), "utf8");

describe("расшифровка соответствует ролику", () => {
  test("в ролике двенадцать реплик — столько же в каждом языке", () => {
    // Число не выдумано: столько блоков в манифесте сценария.
    expect(HOWTO_TRANSCRIPT.ru.length).toBe(12);
    expect(HOWTO_TRANSCRIPT.en.length, "переводов меньше, чем реплик — часть речи пропала").toBe(12);
  });

  test("ни одной пустой или обрезанной строки", () => {
    for (const [язык, строки] of Object.entries(HOWTO_TRANSCRIPT)) {
      строки.forEach((s, i) => {
        expect(s.trim().length, `${язык}[${i}] пуста`).toBeGreaterThan(20);
        expect(s.trim().endsWith("."), `${язык}[${i}] обрывается: ${s.slice(-25)}`).toBe(true);
      });
    }
  });

  test("русская ветка русская, английская без кириллицы", () => {
    expect(HOWTO_TRANSCRIPT.ru.every((s) => /[а-яё]/i.test(s))).toBe(true);
    expect(
      HOWTO_TRANSCRIPT.en.some((s) => /[а-яё]/i.test(s)),
      "в английской расшифровке осталась кириллица",
    ).toBe(false);
  });

  test("незнакомый язык получает английскую, а не пустоту", () => {
    expect(howtoTranscript("kk").length).toBe(12);
    expect(howtoTranscript("de")[0]).toBe(HOWTO_TRANSCRIPT.en[0]);
    expect(howtoTranscript("ru")[0]).toBe(HOWTO_TRANSCRIPT.ru[0]);
  });

  test("расшифровка действительно встроена под видео, а не лежит мёртвым файлом", () => {
    expect(PAGE, "модуль не подключён — текст никто не увидит").toContain("howtoTranscript(lang)");
    expect(PAGE).toContain('t("howto.transcript")');
    for (const [язык, dict] of Object.entries(DEVHUB_DICT)) {
      expect((dict as Record<string, string>)["howto.transcript"], `подпись пуста в ${язык}`).toBeTruthy();
    }
  });

  test("речь про ДевХаб и мультичат в расшифровке сохранена", () => {
    // Ролик называет оба модуля; расшифровка без них обещала бы меньше, чем
    // говорит звук.
    expect(HOWTO_TRANSCRIPT.ru.join(" ")).toContain("ДевХаб");
    expect(HOWTO_TRANSCRIPT.en.join(" ")).toContain("DevHub");
    expect(HOWTO_TRANSCRIPT.en.join(" ").toLowerCase()).toContain("multichat");
  });
});
