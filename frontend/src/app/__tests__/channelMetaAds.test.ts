import { describe, it, expect } from "vitest";
import { channelFrom, postFrom, channelParam } from "@/lib/products";

/*
 * Метка платной кампании Meta: заводилась ДО запуска рекламы книги
 * (задание оркестратора 06.10.2026). Проверяется то, ради чего метка нужна:
 * переход должен опознаваться каналом И нести кампанию отдельным полем,
 * иначе окупаемость конкретной кампании посчитать нечем.
 */
describe("метка платной кампании Meta", () => {
  it("meta-book-<кампания> → канал meta и пост book-<кампания>", () => {
    expect(channelFrom("meta-book-oct")).toBe("meta");
    expect(postFrom("meta-book-oct")).toBe("book-oct");
  });

  it("голая метка meta тоже опознаётся", () => {
    expect(channelFrom("meta")).toBe("meta");
  });

  it("fb остаётся органическим facebook, а не склеивается с платным", () => {
    // Контроль решения не переписывать fb: прошлые переходы уже посчитаны по
    // нему, и смена значения переименовала бы канал задним числом.
    expect(channelFrom("fb")).toBe("facebook");
    expect(channelFrom("fb-book-oct")).toBe("facebook");
  });

  it("отрицательный контроль: похожая, но незаведённая метка даёт null", () => {
    // Форма без дефиса — иначе под-метка законно опознается по префиксу, и
    // контроль проверял бы не то, что написано в его названии.
    expect(channelFrom("metaверн")).toBeNull();
    expect(channelFrom("совсемчужое")).toBeNull();
  });

  it("ссылку для канала собирает channelParam, а не руки", () => {
    expect(channelParam("meta")).toBe("meta");
  });
});
