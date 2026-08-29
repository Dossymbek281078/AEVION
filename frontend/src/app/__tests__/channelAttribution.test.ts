/**
 * Метка канала на ссылках оплаты.
 *
 * Тестов на `withChannel` не было вовсе, хотя от неё зависит единственный ответ
 * на вопрос «что дала раздача роликов». 12.08.2026 выяснилось, что метка
 * доезжала до чекаута, но не попадала ни в один отчёт, который кто-то смотрит:
 * Gumroad строит аналитику только по UTM, а наш ping-обработчик `url_params`
 * не читает. Тесты ниже держат именно это — не форму строки, а то, что в ссылке
 * есть все три поля UTM, без которых Gumroad ссылку в отчёт не заводит.
 */
import { describe, it, expect } from "vitest";
import { withChannel, channelFrom, keepChannel, CHANNELS } from "@/lib/products";

const GUM = "https://aevion.gumroad.com/l/tmuyxw?wanted=true";
const LS = "https://aevion.lemonsqueezy.com/checkout/buy/abc";

/** Разбирает query ссылки в обычную карту — сравниваем значения, а не текст:
 *  порядок параметров ничего не значит, и тест не должен падать из-за него. */
function params(url: string): Record<string, string> {
  const q = url.slice(url.indexOf("?") + 1);
  return Object.fromEntries(new URLSearchParams(q).entries());
}

describe("withChannel — метка канала в ссылке оплаты", () => {
  it("без канала ссылку не трогает вовсе", () => {
    expect(withChannel(GUM, null)).toBe(GUM);
    expect(withChannel(LS, null)).toBe(LS);
  });

  it("у Gumroad проставляет ВСЮ тройку UTM, иначе ссылка не попадёт в отчёт", () => {
    const p = params(withChannel(GUM, "tiktok", "go"));
    expect(p.utm_source).toBe("tiktok");
    expect(p.utm_medium).toBe("social");
    expect(p.utm_campaign).toBe("go");
  });

  it("сохраняет channel= — по нему канал поднимается через API Gumroad", () => {
    expect(params(withChannel(GUM, "tiktok", "go")).channel).toBe("tiktok");
  });

  it("не затирает параметры, которые уже были в ссылке", () => {
    expect(params(withChannel(GUM, "tiktok", "go")).wanted).toBe("true");
  });

  it("печатный QR не выдаётся за соцсеть — иначе их вклад завышен", () => {
    expect(params(withChannel(GUM, "qr-code", "go")).utm_medium).toBe("qr");
    expect(params(withChannel(GUM, "instagram", "go")).utm_medium).toBe("social");
  });

  it("витрина попадает в utm_campaign, а не теряется", () => {
    expect(params(withChannel(GUM, "tiktok", "shop")).utm_campaign).toBe("shop");
    expect(params(withChannel(GUM, "tiktok", "longevity")).utm_campaign).toBe("longevity");
  });

  it("вызов без витрины всё равно даёт валидную тройку, а не пустое поле", () => {
    const p = params(withChannel(GUM, "tiktok"));
    expect(p.utm_campaign).toBeTruthy();
  });

  it("LemonSqueezy остаётся на своём формате — у него UTM не при чём", () => {
    const out = withChannel(LS, "tiktok", "go");
    expect(out).toContain("checkout[custom][channel]=tiktok");
    expect(out).not.toContain("utm_source");
  });

  it("каждая метка из CHANNELS даёт непустой utm_source", () => {
    for (const code of Object.keys(CHANNELS)) {
      const channel = channelFrom(code);
      expect(channel, `метка ${code} не разбирается`).toBeTruthy();
      expect(params(withChannel(GUM, channel, "go")).utm_source).toBe(channel);
    }
  });

  it("чужая метка из адресной строки в ссылку оплаты не попадает", () => {
    expect(channelFrom("../../evil")).toBeNull();
    expect(withChannel(GUM, channelFrom("нет-такого"), "go")).toBe(GUM);
  });
});

describe("keepChannel — метка канала на ВНУТРЕННИХ переходах", () => {
  // Замер 28.08.2026: воронка теряла источник дважды, и оба раза молча —
  // /en/go → /en/longevity и /longevity → /shop. Целевая страница канал читает,
  // ссылка на неё метки не несла, покупка после бесплатного материала приходила
  // в отчёт как «источник неизвестен».
  it("каждая метка переживает переход туда и обратно", () => {
    for (const short of Object.keys(CHANNELS)) {
      const normalized = channelFrom(short);
      const href = keepChannel("/shop", normalized);
      const param = new URL(href, "https://aevion.app").searchParams.get("c");
      expect(channelFrom(param ?? undefined)).toBe(normalized);
    }
  });

  // ЭТОТ ТЕСТ — доказательство, что ловушка настоящая, а не выдуманная. Пока он
  // зелёный, «упростить» keepChannel до подстановки channel нельзя: страница
  // получит длинное значение, channelFrom вернёт null, и метка исчезнет молча.
  it("нормализованное значение НЕ принимается как ?c= — ради этого и функция", () => {
    expect(channelFrom("yt")).toBe("youtube");
    expect(channelFrom("youtube")).toBeNull();
  });

  it("без канала адрес не трогает — лишний ?c= в ссылке не нужен", () => {
    expect(keepChannel("/shop", null)).toBe("/shop");
  });

  it("не затирает уже имеющиеся параметры адреса", () => {
    expect(keepChannel("/shop?tab=books", "youtube")).toBe("/shop?tab=books&c=yt");
  });

  it("неизвестный канал метки не порождает", () => {
    expect(keepChannel("/shop", "myspace")).toBe("/shop");
  });
});
