/**
 * 🔴 ПОКУПАТЕЛЬ ПРЕДУПРЕЖДЁН, ЧТО ПЛАТФОРМА В РАЗРАБОТКЕ — ДО ОПЛАТЫ.
 *
 * Прямое слово основателя 12.10.2026: сказать, что AEVION в активной
 * разработке и возможны сбои; что мы их исправляем; и что время, когда платная
 * возможность не работала ПО НАШЕЙ ВИНЕ, компенсируется продлением подписки.
 * Показывать рядом с кнопками покупки и калькулятором, на экранах «входит в
 * подписку» и на странице после оплаты — не мелким шрифтом в подвале.
 *
 * Сторож держит три вещи, каждая из которых ломается молча:
 *   1. текст говорит ВСЕ три вещи (разработка, починка, компенсация продлением)
 *      и даёт адрес, на который можно написать;
 *   2. он стоит на ВСЕХ трёх поверхностях — знаменатель 3 из 3;
 *   3. он есть на ВСЕХ трёх языках — ru, en, kk. Словари под сторожем
 *      равенства ключей, и ключ, добавленный в два из трёх, покраснеет там;
 *      здесь проверяется другое — что перевод не пустой и не копия русского.
 *
 * ⚠️ Чего сторож НЕ утверждает: что блок видно в первом экране. Это пиксели, и
 * они меряются браузером на проде после выкатки, отдельно.
 */
import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RazrabotkaPreduprezhdenie, ADRES_PODDERZHKI } from "../RazrabotkaPreduprezhdenie";
import ru from "@/lib/i18n-lang/ru";
import en from "@/lib/i18n-lang/en";
import kk from "@/lib/i18n-lang/kk";

vi.mock("@/lib/i18n", () => ({ useI18nOptional: () => null }));

const КЛЮЧИ = ["razrabotka.notice", "razrabotka.write"] as const;

function файл(путь: string): string {
  return readFileSync(join(process.cwd(), путь), "utf8");
}

describe("предупреждение о разработке", () => {
  test("🔴 текст говорит все три вещи и даёт адрес", () => {
    render(<RazrabotkaPreduprezhdenie />);
    const текст = document.body.textContent ?? "";
    expect(текст, "не сказано, что платформа в разработке").toMatch(/в активной разработке/i);
    expect(текст, "не сказано про возможные сбои").toMatch(/сбои/i);
    expect(текст, "не сказано, что мы их исправляем").toMatch(/исправля/i);
    expect(текст, "не обещано продление — а обещать проценты или возврат мы не можем").toMatch(/продлением подписки/i);
    expect(текст).toContain(ADRES_PODDERZHKI);
  });

  test("🔴 адрес — кликабельное письмо, а не просто строка", () => {
    const { container } = render(<RazrabotkaPreduprezhdenie />);
    const ссылка = container.querySelector(`a[href="mailto:${ADRES_PODDERZHKI}"]`);
    expect(ссылка, "адрес не ссылка — человеку придётся его перепечатывать").toBeTruthy();
  });

  test("🔴 корень — span: плашка модуля сама <span>, блок внутри неё рвёт вёрстку", () => {
    for (const вид of ["блок", "строка"] as const) {
      const { container } = render(<RazrabotkaPreduprezhdenie вид={вид} />);
      const корень = container.firstElementChild!;
      expect(корень.tagName, `вид «${вид}» отрисован как ${корень.tagName}`).toBe("SPAN");
      expect(getComputedStyle(корень).display).toBe("block");
    }
  });

  test("🔴 стоит на ВСЕХ трёх поверхностях — знаменатель 3 из 3", () => {
    const поверхности: Array<[string, string]> = [
      ["страница цен (карточки и калькулятор)", "src/app/pricing/page.tsx"],
      ["плашка «входит в подписку» модулей", "src/components/ModulePricingChip.tsx"],
      ["страница после оплаты", "src/app/pricing/checkout/success/page.tsx"],
    ];
    /*
     * 🔴 Считаем ИСПОЛЬЗОВАНИЯ `<RazrabotkaPreduprezhdenie`, а не упоминания
     * имени. Первая редакция искала имя — и мутация «снять блок с плашки
     * модулей» прошла НАСКВОЗЬ: имя осталось в строке импорта, проверка
     * позеленела на поверхности, где предупреждения больше нет. Тот же класс,
     * что «текст О вещи неотличим от вещи».
     */
    const без = поверхности.filter(([, путь]) => !/<RazrabotkaPreduprezhdenie[\s/>]/.test(файл(путь)));
    expect(без.map(([имя]) => имя), "поверхность без предупреждения").toEqual([]);
    // На странице цен их ДВА: над сеткой тарифов и у кнопки калькулятора —
    // туда приходят, минуя карточки.
    const цены = файл("src/app/pricing/page.tsx");
    expect((цены.match(/<RazrabotkaPreduprezhdenie/g) || []).length).toBe(2);
  });

  test("🔴 есть на трёх языках, и перевод не копия русского", () => {
    const словари: Array<[string, Record<string, string>]> = [["ru", ru], ["en", en], ["kk", kk]];
    for (const [имя, словарь] of словари) {
      for (const ключ of КЛЮЧИ) {
        const v = словарь[ключ];
        expect(v, `в словаре ${имя} нет ключа ${ключ}`).toBeTruthy();
        expect(String(v).trim().length, `${имя}.${ключ} пуст`).toBeGreaterThan(3);
      }
    }
    // Контроль: en и kk — НЕ русский текст, скопированный как есть.
    for (const [имя, словарь] of словари.slice(1)) {
      expect(словарь["razrabotka.notice"], `${имя} повторяет русский — перевода нет`)
        .not.toBe(ru["razrabotka.notice"]);
    }
    // И обещание компенсации переведено, а не потеряно при переводе.
    expect(en["razrabotka.notice"]).toMatch(/extend/i);
    expect(kk["razrabotka.notice"]).toMatch(/жазылым/i);
  });

  test("обещаем ровно продление — ни процентов, ни возврата денег", () => {
    // Обещание, которое нельзя исполнить тихо и сразу, на продающей странице
    // не пишется: возврат это касса, сроки и решение человека.
    for (const словарь of [ru, en, kk]) {
      const t = String(словарь["razrabotka.notice"]).toLowerCase();
      expect(t).not.toMatch(/\d+\s*%/);
      expect(t).not.toMatch(/refund|возврат денег|ақшаны қайтар/);
    }
  });
});
