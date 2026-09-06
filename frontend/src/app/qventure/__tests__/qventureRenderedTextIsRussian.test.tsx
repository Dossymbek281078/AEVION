import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { sobratVidimyj, angliyskieStroki, tolkoLatinica, ostalosLatinskoeSlovo, TERMINY_OBSHIE } from "@/test-utils/renderedText";

/**
 * Экран модуля говорит по-русски — проверка по ОТРИСОВАННОЙ странице.
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ qventureSpeaksOneLanguage. Тот сторож читает ИСХОДНИК и
 * знает конечный список форм записи: текст между тегами, атрибут, свойство
 * объекта, аргумент функции. За три дня я добавлял в него форму ЧЕТЫРЕЖДЫ, и
 * каждый раз он был зелёным при живом английском на экране.
 *
 * Перечисление форм не сходится: их столько, сколькими способами React умеет
 * доставить строку в DOM. Здесь вопрос задан с другой стороны — что ВИДИТ
 * человек, — и он не зависит от того, как текст туда попал.
 *
 * ГРАНИЦА, которую надо знать. Отрисовка показывает страницу в НАЧАЛЬНОМ
 * состоянии: сообщения об ошибках, отказ платной стены и результат разбора
 * сюда не попадают — их проверяет исходниковый сторож и отдельные тесты.
 * Зелёный цвет здесь означает «то, что человек видит СРАЗУ», не больше.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/qventure",
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));

import QVenturePage from "../page";

/** Термины сверх общего списка — финансовые сокращения этого модуля. */
const TERMINY = [...TERMINY_OBSHIE, "QVenture", "ARR", "LTV", "CAC", "TAM", "SOM", "SAM", "MRR", "IRR", "IC", "MoM", "WoW", "YoY", "KZ", "US"];

describe("экран QVenture говорит по-русски (по отрисовке)", () => {
  test("КОНТРОЛЬ: правило отличает английское от русского", () => {
    // Без этой пары мутация «tolkoLatinica всегда false» проходит: сторож
    // перестаёт находить что-либо, а контроли охвата остаются зелёными.
    expect(tolkoLatinica("Transparent"), "английское не распознано").toBe(true);
    expect(tolkoLatinica("Прозрачно"), "русское принято за английское").toBe(false);
    expect(tolkoLatinica("QVenture — разбор"), "смешанное принято за английское").toBe(false);
    // И отбор терминов: латиница по природе не должна становиться находкой.
    expect(ostalosLatinskoeSlovo("ARR USD", TERMINY), "термины не отсеиваются").toBe(false);
    expect(ostalosLatinskoeSlovo("Upload deck", TERMINY), "отсев съедает настоящее").toBe(true);
  });

  test("видимый текст и подписи — не английские", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { container } = render(<QVenturePage />);

    const v = sobratVidimyj(container);

    // КОНТРОЛЬ ОХВАТА: страница отрисовалась и текст собран. Пустая выборка
    // сделала бы проверку зелёной на любом состоянии модуля.
    expect(v.tekst.length, "видимого текста не найдено — страница не отрисовалась").toBeGreaterThan(40);
    // У КАЖДОГО сборщика свой контроль. Мутация «отключить сбор атрибутов»
    // проходила молча: общего счёта хватало за счёт текстовых узлов, а
    // подписи для читалки и подсказки полей выпадали из проверки целиком.
    expect(v.atributy.length, "атрибутов не собрано — подписи для читалки вне проверки").toBeGreaterThan(8);
    // И контроль в обратную сторону: русский текст на странице ЕСТЬ, то есть
    // мы смотрим на русскую страницу, а не на пустую разметку.
    expect(
      v.vsyo.filter((s) => /[А-ЯЁа-яё]/.test(s)).length,
      "русского текста нет вовсе — проверка бессмысленна",
    ).toBeGreaterThan(20);

    const angliyskie = angliyskieStroki(v, TERMINY);

    expect(
      angliyskie,
      "английский текст на русском экране: человек читает его первым, до всякой ошибки",
    ).toEqual([]);
  });
});
