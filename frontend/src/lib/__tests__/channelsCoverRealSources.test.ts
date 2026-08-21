/**
 * Метки каналов должны покрывать те площадки, где мы ДЕЙСТВИТЕЛЬНО публикуем.
 *
 * `channelFrom` намеренно превращает неизвестное значение в null — иначе
 * первый же чужой параметр в ссылке завёл бы в выгрузке мусорный канал. Но у
 * этого решения есть обратная сторона: площадка, которой нет в списке,
 * молча теряет происхождение человека. 21.08.2026 так было с Дзеном, куда
 * идёт русский трафик.
 *
 * Тест держит СПИСОК, а не механизм: механизм проверен рядом, а список —
 * это решение о том, где мы работаем, и оно должно меняться осознанно.
 */
import { describe, it, expect } from "vitest";
import { CHANNELS, channelFrom } from "../products";

describe("метки каналов", () => {
  it("покрывают площадки, где мы публикуем", () => {
    for (const short of ["ig", "tt", "yt", "tg", "dz", "vk"]) {
      expect(CHANNELS[short], `нет метки для ?c=${short}`).toBeTruthy();
    }
  });

  it("неизвестная метка даёт null, а не мусорный канал", () => {
    expect(channelFrom("не-существует")).toBeNull();
    expect(channelFrom(undefined)).toBeNull();
    expect(channelFrom("")).toBeNull();
  });

  it("регистр и пробелы не мешают", () => {
    expect(channelFrom(" DZ ")).toBe("dzen");
    expect(channelFrom("IG")).toBe("instagram");
  });

  it("массив параметров берёт первое значение", () => {
    expect(channelFrom(["tt", "ig"])).toBe("tiktok");
  });
});
