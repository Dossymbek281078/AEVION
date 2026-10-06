import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import LongevityClient from "../_client";

/**
 * ССЫЛКА ПОКУПКИ НЕСЁТ НАЗВАНИЕ КАМПАНИИ — ИНАЧЕ РЕКЛАМА НЕ УЧИТЫВАЕТСЯ.
 *
 * 🔴 Повод 06.10.2026: 06–07.10 запускается реклама книги в Meta на
 * /longevity?c=meta-book-<кампания>, а продажу с рекламы на Gumroad нельзя было
 * отличить от прочих.
 *
 * Замер, который нашёл НАСТОЯЩУЮ причину: `channelFrom` нормализует метку в известный
 * канал, а всё неизвестное роняет в null — намеренно, чтобы не записать выдуманный
 * канал. Составная рекламная метка в список каналов не входит, поэтому `withChannel`
 * получал channel=null и возвращал ссылку БЕЗ ИЗМЕНЕНИЙ: на кассу не уезжало ни метки,
 * ни UTM. То есть дело было не в «перенести ?c= в utm», а в том, что терялось всё.
 *
 * Что проверено на живой кассе 06.10 (не по справке — она с нашей машины недоступна):
 * `aevion.gumroad.com/l/orcfbo?wanted=true&utm_source=…&utm_campaign=…` отдаёт 200, и
 * метки доезжают до адреса оплаты вместе с `wanted=true`, товар тот.
 */

const ПЕРЕВОД = String.fromCharCode(10); // эскейп съедается на границе вызова (§2е)

function ссылкаКниги(props: { channel?: string | null; сыраяМетка?: string | null }): string {
  const { container } = render(<LongevityClient {...props} />);
  const узел = container.querySelector("#kniga a") ?? container.querySelector("#kniga");
  const href = узел?.getAttribute("href") ?? "";
  return href;
}

describe("ссылка покупки книги несёт кампанию", () => {
  test("рекламная метка уезжает в utm_source и utm_campaign, wanted=true цел", () => {
    const href = ссылкаКниги({ channel: null, сыраяМетка: "meta-book-spring" });
    process.stderr.write(`[сторож] ссылка с рекламной меткой: ${href}` + ПЕРЕВОД);
    expect(href, "ссылки книги нет вовсе").toContain("gumroad.com/l/orcfbo");
    expect(href, "метка не попала в utm_source").toContain("utm_source=meta-book-spring");
    expect(href, "названия кампании нет — в кассе продажу не отличить").toContain(
      "utm_campaign=meta-book-spring",
    );
    expect(href, "wanted=true потерян: покупка открылась бы не сразу").toContain("wanted=true");
  });

  test("КОНТРОЛЬ: без метки ссылка как прежде — ни одного utm_", () => {
    // Иначе правка добавляла бы мусор всем, кто пришёл без метки, и «метка есть
    // всегда» нельзя было бы отличить от «метка работает».
    const href = ссылкаКниги({ channel: null, сыраяМетка: null });
    process.stderr.write(`[сторож] контроль без метки: ${href}` + ПЕРЕВОД);
    expect(href).toContain("wanted=true");
    expect(href.includes("utm_"), "без метки в ссылке появились utm_ — это мусор").toBe(false);
  });

  test("известный канал остаётся главным: utm_source — его каноничное имя", () => {
    // Канал и кампания отвечают на разные вопросы: «откуда человек» и «какая реклама».
    // Если канал известен, его имя обязано совпадать с нашими отчётами, иначе один
    // канал заживёт под двумя именами — это у нас уже случалось.
    const href = ссылкаКниги({ channel: "instagram", сыраяМетка: "ig" });
    expect(href, "известный канал подменён сырой меткой").toContain("utm_source=instagram");
    expect(href, "кампания должна остаться входящей меткой").toContain("utm_campaign=ig");
  });
});
