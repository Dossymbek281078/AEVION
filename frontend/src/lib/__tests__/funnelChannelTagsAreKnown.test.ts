// Метки воронки DevHub и Multichat обязаны быть ИЗВЕСТНЫ сайту. 28.09.2026 сторож целей
// поста (aevion-queue-targets-check.mjs --fayl) назвал все четыре неизвестными: ссылки в
// готовых постах и в брифе платной кампании работали, а channelFrom возвращал по ним null —
// то есть каждый пришедший по рекламе уходил в «unattributed», и ответа «какой пост дал
// продажу» не было бы ни по одному каналу. Пост отрабатывает один раз, проверять после
// публикации поздно.
import { describe, it, expect } from "vitest";
import { channelFrom, withChannel, channelParam } from "../products";

const МЕТКИ = ["x-devhub", "x-multichat", "ads-devhub", "ads-multichat"];

describe("метки воронки DevHub и Multichat", () => {
  it("каждая метка опознаётся, а не превращается в null", () => {
    for (const м of МЕТКИ) expect(channelFrom(м), м).toBe(м);
  });

  it("платный и бесплатный источник различимы", () => {
    expect(channelFrom("x-devhub")).not.toBe(channelFrom("ads-devhub"));
    expect(channelFrom("x-multichat")).not.toBe(channelFrom("ads-multichat"));
  });

  it("метка доезжает до адреса покупки", () => {
    for (const м of МЕТКИ) expect(withChannel("/pricing", м), м).toContain(м);
  });

  it("контроль: выдуманная метка по-прежнему null", () => {
    expect(channelFrom("x-devhub-выдуманный")).toBeNull();
    expect(channelFrom("ads-нет-такого")).toBeNull();
  });

  it("у Reddit два ключа, и короткий — первый (его кладёт набор запуска)", () => {
    // 28.09.2026: после объединения веток в CHANNELS оказались и rd, и reddit.
    // channelParam берёт ПЕРВЫЙ ключ с этим значением, и набор запуска должен
    // получать rd; при этом набранное руками «reddit» обязано узнаваться.
    expect(channelParam("reddit")).toBe("rd");
    expect(channelFrom("reddit")).toBe("reddit");
    expect(channelFrom("rd")).toBe("reddit");
  });
});
