/**
 * Плашка «вам нужна страница /proof» показывается РОВНО тем, кому писали.
 *
 * ПОВОД (11.10.2026). Шестнадцать писем площадкам лицензирования и дата-
 * компаниям ушли со ссылками на `/bureau?c=mail-aiN`. Ссылку в отправленном
 * письме задним числом не исправить, а на /bureau нет ни слова provenance,
 * training data или dataset: получатель попадает на витрину бюро для авторов
 * и не находит ничего из того, что ему написали. Посадочная /proof для него
 * уже есть — он о ней не знает.
 *
 * Сторож держит обе половины, и вторая важнее первой:
 *   1. пришедший по письму ВИДИТ ссылку на /proof;
 *   2. все остальные её НЕ видят. Бюро — платный канал; плашка, показанная
 *      всем, увела бы его покупателей на страницу, которая ничего не продаёт,
 *      то есть лечила бы одно место за счёт другого.
 *
 * Проверка поведенческая: компонент РЕНДЕРИТСЯ, и утверждение идёт о том, что
 * оказалось на экране. Источник метки (`channelNow`/`postNow`) подменён — у
 * него свои сторожа; здесь проверяется ровно моё условие «какие пары
 * (канал, подметка) показывают плашку».
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

const метка = vi.hoisted(() => ({
  канал: null as string | null,
  пост: null as string | null,
  падать: false,
}));

vi.mock("@/lib/channelNow", () => ({
  channelNow: () => {
    if (метка.падать) throw new Error("sessionStorage недоступен");
    return метка.канал;
  },
  postNow: () => {
    if (метка.падать) throw new Error("sessionStorage недоступен");
    return метка.пост;
  },
}));

const { DataBuyerNotice } = await import("../page");

beforeEach(() => {
  метка.канал = null;
  метка.пост = null;
  метка.падать = false;
});
afterEach(() => cleanup());

/** Ссылку ищем по ЦЕЛИ, а не по тексту: текст перепишут, адрес — смысл плашки. */
function ссылкаНаProof() {
  return document.querySelector('a[href="/proof"]');
}

describe("плашка для покупателей данных на /bureau", () => {
  it("КОНТРОЛЬ: без метки плашки нет — значит дальше «видно» что-то значит", async () => {
    render(<DataBuyerNotice />);
    await waitFor(() => expect(ссылкаНаProof()).toBeNull());
  });

  it("пришедшему по письму показывает ссылку на /proof", async () => {
    метка.канал = "mail-outreach";
    метка.пост = "ai12";
    render(<DataBuyerNotice />);
    await waitFor(() => expect(ссылкаНаProof()).not.toBeNull());
    // Слова из письма обязаны быть на экране: иначе человек снова не поймёт, куда попал.
    expect(screen.getByText(/provenance/i)).toBeTruthy();
  });

  /*
   * Отрицательные примеры отличаются от положительного РОВНО одним признаком —
   * иначе они ничего не охраняют. Поэтому канал и подметка меняются по одному.
   */
  it.each([
    ["другой канал, та же подметка", "instagram", "ai12"],
    ["тот же канал, подметка не из писем", "mail-outreach", "post7"],
    ["тот же канал, подметки нет вовсе", "mail-outreach", null],
    ["подметка похожа, но не число", "mail-outreach", "aiX"],
    ["канала нет, подметка есть", null, "ai12"],
  ])("НЕ показывает: %s", async (_имя, канал, пост) => {
    метка.канал = канал;
    метка.пост = пост;
    render(<DataBuyerNotice />);
    await waitFor(() => expect(ссылкаНаProof()).toBeNull());
  });

  it("недоступное хранилище не роняет страницу бюро", async () => {
    метка.падать = true;
    expect(() => render(<DataBuyerNotice />)).not.toThrow();
    await waitFor(() => expect(ссылкаНаProof()).toBeNull());
  });
});
