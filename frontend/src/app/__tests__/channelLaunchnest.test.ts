import { describe, it, expect } from "vitest";
import { channelFrom, CHANNELS } from "@/lib/products";

/**
 * Каталог LaunchNest (подача 30.09.2026): размещение бесплатное в обмен на наш
 * значок у них, обратная ссылка несёт ?c=launchnest.
 *
 * Тест держит обе стороны. Первая: метка распознаётся — иначе переход уйдёт в
 * «unattributed» и вопрос «дал ли каталог людей» останется без ответа, а он и
 * есть единственная причина туда идти. Вторая: выдуманная метка ПО-ПРЕЖНЕМУ
 * отбрасывается — белый список не должен превратиться в «пропускаем всё», иначе
 * любая строка из адресной строки станет каналом.
 */
describe("канал launchnest", () => {
  it("метка из каталога распознаётся", () => {
    expect(channelFrom("launchnest")).toBe("launchnest");
    expect(CHANNELS.launchnest).toBe("launchnest");
  });

  it("выдуманная метка по-прежнему отбрасывается", () => {
    expect(channelFrom("launchnest-fake")).toBeNull();
    expect(channelFrom("совсем-чужое")).toBeNull();
  });

  it("прежние каналы не задеты", () => {
    expect(channelFrom("ph")).toBe("product-hunt");
    expect(channelFrom("ig")).toBe("instagram");
    expect(channelFrom("badge")).toBe("badge");
  });
});
