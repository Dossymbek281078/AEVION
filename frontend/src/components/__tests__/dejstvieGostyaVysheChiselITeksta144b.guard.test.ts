import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 144б (18.10.2026): у трёх приложений первое действие гостя стояло ниже полосы чисел / фишек-преимуществ и
 * уезжало за кадр телефона. Замер на проде 627d18515 (390×844, свой прибор 144-niže.mjs): qlife — первое поле
 * формы биомаркера ~930; mapreality — первая кнопка формы сигнала ~928; qcontract — ссылка «Создать» ~1192 (py-24
 * сверху + четыре фишки до кнопки). Порядок в разметке: действие → остальное. Пиксели меряет браузер на проде.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("144б: действие гостя выше чисел и преимуществ", () => {
  test("🔴 qlife: форма биомаркера раньше плашки цены и полосы чисел", () => {
    const s = файл("src/app/qlife/page.tsx");
    const форма = s.indexOf("<BiomarkerForm onLogged={handleLogged} />");
    const плашка = s.indexOf('<ModulePricingChip moduleId="qlife"');
    const числа = s.indexOf("<StatsStrip refreshKey={statsKey} />");
    expect(форма).toBeGreaterThan(0);
    expect(плашка).toBeGreaterThan(форма);
    expect(числа).toBeGreaterThan(плашка);
    expect(s.split('<ModulePricingChip moduleId="qlife"').length - 1).toBe(1);
  });
  test("🔴 mapreality: форма сигнала раньше полосы чисел", () => {
    const s = файл("src/app/mapreality/page.tsx");
    const форма = s.indexOf("<SignalForm authorAlias={alias} onSubmitted={handleSubmitted} />");
    const числа = s.indexOf("<StatsBar refreshKey={refreshKey} />");
    expect(форма).toBeGreaterThan(0);
    expect(числа).toBeGreaterThan(форма);
  });
  test("🔴 qcontract: ссылка создания раньше фишек-преимуществ, верхнее поле героя py-10 на телефоне", () => {
    const s = файл("src/app/qcontract/page.tsx");
    const герой = s.indexOf('className="max-w-3xl mx-auto px-6 py-8 md:py-10 text-center"'); // 144г: было py-10 md:py-24, на 1463×724 h1 стоял на 582
    expect(герой, "нет героя с py-8 md:py-10").toBeGreaterThan(0);
    const кусок = s.slice(герой, s.indexOf("{/* Dashboard */}", герой));
    const ссылка = кусок.indexOf('href="/qcontract/create"');
    const фишки = кусок.indexOf('t("qcontract.home.hero.feat.password")');
    expect(ссылка).toBeGreaterThan(0);
    expect(фишки).toBeGreaterThan(ссылка);
    expect(кусок.split('href="/qcontract/create"').length - 1).toBe(1);
  });
});
