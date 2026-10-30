import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tq } from "../qrightI18n";

/**
 * 30.10.2026, прод (гость, 390 px, en): гость регистрирует работу на /qright и после экрана
 * «Protected. Provable. Permanent.» не получает НИ ОДНОЙ подсказки «создайте аккаунт / войдите —
 * работа будет в вашем кабинете». Работа остаётся без кабинета, человек — без причины вернуться.
 *
 * Сторож держит оба конца: подсказка стоит в блоке done и показывается только гостю (!hasAuth),
 * ссылка строится через auth/loginHref.ts (next=/bureau + метка канала), тексты — через словарь
 * страницы и переведены на ru/kk.
 */
const PAGE = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const ПОДСКАЗКА = "Create an account with this same email — the work will appear in your dashboard.";
const КНОПКА = "Create account or sign in →";

describe("гость после защиты видит подсказку про аккаунт", () => {
  test("подсказка в блоке done, только гостю, ссылка — вход с возвратом в бюро", () => {
    const i = PAGE.indexOf('{step === "done" && result && (');
    expect(i).toBeGreaterThan(0);
    const done = PAGE.slice(i, i + 5000);
    const j = done.indexOf("data-qright-guest-account-hint");
    expect(j, "подсказки гостю в блоке done нет").toBeGreaterThan(0);
    // Условие стоит ПЕРЕД подсказкой и в пределах одной разметки: вошедшему она не нужна.
    expect(done.slice(Math.max(0, j - 400), j)).toContain("{!hasAuth && (");
    expect(done.slice(j, j + 900)).toContain("href={ссылкаВходаВБюро}");
    expect(PAGE).toContain('useСсылкаВхода("/bureau")');
    expect(PAGE).toContain('from "../auth/loginHref"');
  });

  test("тексты подсказки идут через словарь и переведены на ru и kk", () => {
    for (const en of [ПОДСКАЗКА, КНОПКА]) {
      expect(PAGE, en).toContain(`tq(lang, ${JSON.stringify(en)})`);
      expect(tq("en", en)).toBe(en);
      expect(tq("ru", en), en).toMatch(/[А-Яа-яЁё]/);
      expect(tq("kk", en), en).not.toBe(en);
      expect(tq("kk", en), en).not.toBe(tq("ru", en));
    }
    expect(tq("ru", ПОДСКАЗКА)).toBe("Создайте аккаунт на эту же почту — работа появится в вашем кабинете.");
  });
});
