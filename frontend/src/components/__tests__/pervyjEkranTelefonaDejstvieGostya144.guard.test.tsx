import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RazrabotkaPreduprezhdenie, ADRES_PODDERZHKI } from "../RazrabotkaPreduprezhdenie";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => null }));

/*
 * 🔴 144 (18.10.2026): первый экран приложения на телефоне — действие гостя первым. Замер окна «Почта» 18.10 по 45
 * приложениям: действие гостя в кадре на 390×844 у 23, на 1463×724 у 30. Свой замер /startup-exchange на проде
 * eaca8fb62, 390×844: шапка 0..55, навигация Wave1Nav 55..217 (7 строк переносов), плашка цены с полным
 * предупреждением о разработке до ~410, заголовок 467..659, кнопка «Опишите проект» за кадром.
 * Три общих рычага (118 страниц с Wave1Nav, 43 с плашкой): (1) навигация на ≤768 — одна строка с боковой
 * прокруткой; (2) предупреждение о разработке на ≤768 свёрнуто в <details>, полный текст и адрес — одним нажатием,
 * на десктопе как было; (3) на бирже стартапов кнопка гостя стоит сразу под заголовком, абзац и плашка — ниже.
 * Пиксели меряет браузер на проде (144-gost.mjs, до/после); здесь — то, что ломается молча при правке.
 */
const файл = (п: string) => readFileSync(join(process.cwd(), п), "utf8");

describe("144: навигация и предупреждение не съедают первый экран телефона", () => {
  test("🔴 Wave1Nav несёт класс aevion-wave1nav, а globals.css на ≤768 делает его одной строкой с прокруткой", () => {
    expect(файл("src/components/Wave1Nav.tsx")).toContain('<nav className="aevion-wave1nav"');
    const css = файл("src/app/globals.css");
    const медиа = css.slice(css.indexOf("/* ── 144 (18.10.2026)")); // блок 144 и всё после него (147: последний медиа-блок уже не наш)
    expect(медиа).toContain(".aevion-wave1nav {");
    expect(медиа).toContain("flex-wrap: nowrap !important;");
    expect(медиа).toContain("overflow-x: auto;");
    expect(медиа).toContain(".aevion-wave1nav > * { flex: 0 0 auto; }");
    // свёрнутое предупреждение: вне медиа скрыто краткое, внутри медиа скрыто полное
    expect(css).toContain(".aevion-razrabotka-kratko { display: none; }");
    expect(медиа).toContain(".aevion-razrabotka-polno { display: none; }");
    expect(медиа).toContain(".aevion-razrabotka-kratko { display: block; }");
  });

  test("🔴 строка предупреждения: полный вариант и свёрнутый <details> оба несут три обещания и адрес", () => {
    const { container } = render(<RazrabotkaPreduprezhdenie вид="строка" />);
    const полно = container.querySelector(".aevion-razrabotka-polno");
    const кратко = container.querySelector("details.aevion-razrabotka-kratko");
    expect(полно, "нет полного варианта (десктоп)").toBeTruthy();
    expect(кратко, "нет свёрнутого варианта (телефон)").toBeTruthy();
    for (const эл of [полно!, кратко!]) {
      const т = эл.textContent ?? "";
      expect(т).toMatch(/в активной разработке/i);
      expect(т).toMatch(/продлением подпис/i);
      expect(эл.querySelector(`a[href="mailto:${ADRES_PODDERZHKI}"]`), "адрес не ссылка").toBeTruthy();
    }
    expect(кратко!.querySelector("summary")?.textContent).toContain("подробнее");
  });

  test("🔴 ключ razrabotka.kratko есть в ru/en/kk, переводы не копия русского", () => {
    const словари = { ru, en, kk } as Record<string, Record<string, string>>;
    for (const [язык, сл] of Object.entries(словари)) expect(сл["razrabotka.kratko"], `нет ключа в ${язык}`).toBeTruthy();
    expect(en["razrabotka.kratko"]).not.toBe(ru["razrabotka.kratko"]);
    expect(kk["razrabotka.kratko"]).not.toBe(ru["razrabotka.kratko"]);
  });

  test("🔴 биржа стартапов: кнопка гостя сразу под заголовком, абзац и плашка цены после, плашка одна", () => {
    const src = файл("src/app/startup-exchange/page.tsx");
    const h1 = src.indexOf("Идея, MVP или готовый продукт");
    const кнопка = src.indexOf("Опишите проект — покажу бесплатный разбор");
    const абзац = src.indexOf("Хорошие идеи гибнут не потому");
    const шапкаЗакрыта = src.indexOf("</header>");
    const плашка = src.indexOf('<ModulePricingChip moduleId="startup-exchange"');
    expect(h1).toBeGreaterThan(0);
    expect(кнопка).toBeGreaterThan(h1);
    expect(абзац).toBeGreaterThan(кнопка);
    expect(плашка).toBeGreaterThan(шапкаЗакрыта);
    expect(src.split('<ModulePricingChip moduleId="startup-exchange"').length - 1).toBe(1);
  });
});
