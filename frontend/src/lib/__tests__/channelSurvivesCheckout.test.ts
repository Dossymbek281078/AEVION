/**
 * Метка канала обязана пережить поход в кассу.
 *
 * Замер 31.08.2026: ни один из четырёх адресов возврата не несёт `c=`, а канал
 * читался только из адреса. Значит покупка приходила без источника — цепочка
 * привязки обрывалась на последнем шаге, том самом, ради которого её строили.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function свежийТрекер() {
  vi.resetModules();
  return (await import("../track")).track;
}

function адрес(search: string, pathname = "/pricing") {
  Object.defineProperty(window, "location", {
    value: { search, pathname, href: `https://aevion.app${pathname}${search}` },
    writable: true,
  });
}

let отправлено: Array<Record<string, unknown>>;

beforeEach(() => {
  sessionStorage.clear();
  отправлено = [];
  // Отдаём false, чтобы замер ушёл через fetch: у sendBeacon тело — Blob, и
  // читается оно асинхронно. Обе ветки шлют ОДНО тело, проверяем доступную.
  vi.stubGlobal("navigator", { sendBeacon: () => false });
  vi.stubGlobal(
    "fetch",
    vi.fn((_u: string, init: RequestInit) => {
      отправлено.push(JSON.parse(String(init.body)));
      return Promise.resolve({ ok: true } as Response);
    }),
  );
});

const канал = (i = 0) =>
  (отправлено[i]?.meta as Record<string, unknown> | undefined)?.channel;

describe("выбор хранилища закреплён", () => {
  it("канал живёт во ВКЛАДКЕ, а не переживает её", () => {
    /*
     * Это осознанное решение с денежным последствием, а не деталь.
     *
     * Долгое хранилище пережило бы закрытие вкладки, и покупка досталась бы
     * каналу, по которому человек заходил неделю назад. Завышение опаснее
     * пропуска: по нему увеличивают бюджет каналу, который его не заработал, а
     * пропуск виден как «источник неизвестен».
     *
     * Поодиночке подмену ловят поведенческие проверки — но только потому, что
     * чтение и запись расходятся. Переведи кто-нибудь ОБА разом, они бы прошли:
     * набор чистит sessionStorage между тестами и не чистит localStorage.
     * Поэтому закрепляем сам выбор.
     */
    const источник = readFileSync(
      join(process.cwd(), "src/lib/channelNow.ts"),
      "utf8",
    );
    expect(источник, "канал должен жить в хранилище вкладки").toContain("sessionStorage");
    expect(
      источник,
      "долгое хранилище отдало бы покупку каналу недельной давности",
    ).not.toContain("localStorage");
  });
});

describe("канал переживает кассу", () => {
  it("возврат из кассы без метки в адресе сохраняет источник", async () => {
    const track = await свежийТрекер();
    адрес("?c=tt");
    track({ type: "checkout_start", source: "pricing" });
    // Касса вернула покупателя: своей метки в адресе НЕТ ни у одной из четырёх.
    адрес("?paybox=1&ref=abc", "/pricing/checkout/success");
    track({ type: "checkout_success", source: "pricing" });
    expect(канал(0)).toBe("tiktok");
    expect(канал(1)).toBe("tiktok");
  });

  it("без канала в этой вкладке источник не выдумывается", async () => {
    const track = await свежийТрекер();
    адрес("?paybox=1&ref=abc", "/pricing/checkout/success");
    track({ type: "checkout_success", source: "pricing" });
    expect(канал(0)).toBeUndefined();
  });

  it("держим ПЕРВОЕ касание, как и сервер", async () => {
    const track = await свежийТрекер();
    адрес("?c=tt");
    track({ type: "page_view", source: "pricing" });
    адрес("?c=yt");
    track({ type: "page_view", source: "pricing" });
    адрес("", "/pricing/checkout/success");
    track({ type: "checkout_success", source: "pricing" });
    // первое касание — tiktok, второе — youtube; побеждает первое
    expect(канал(2)).toBe("tiktok");
  });

  it("мусор из хранилища не становится каналом", async () => {
    sessionStorage.setItem("aevion_gtm_channel", "<script>");
    const track = await свежийТрекер();
    адрес("", "/pricing/checkout/success");
    track({ type: "checkout_success", source: "pricing" });
    expect(канал(0)).toBeUndefined();
  });
});
