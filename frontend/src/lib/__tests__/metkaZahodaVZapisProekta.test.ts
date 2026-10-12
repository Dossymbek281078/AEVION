/**
 * 🔴 МЕТКА ЗАХОДА ЕДЕТ В ЗАПИСЬ ПРОЕКТА DevHub.
 *
 * Зачем. Воронка знает заходы на страницу, но самый ценный шаг пути —
 * «человек собрал приложение» — был безымянным: источник обрывался на входе.
 * На вопрос «с какого ролика дошли до сборки» ответить было нечем, то есть
 * нельзя было сказать, какой ролик снимать ещё, а какой перестать.
 *
 * Вторая польза: по метке `probe-*` сервер сам снимает наши пробные сайты.
 * Прежний признак был один — ИМЯ проекта, и окнам приходилось портить его
 * словом «probe», хотя у окна роликов имя видно В КАДРЕ записи.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

async function свежая() {
  vi.resetModules();
  return (await import("../channelNow")).меткаЗаходаДляЗаписи;
}

function адрес(search: string) {
  Object.defineProperty(window, "location", {
    value: { search, pathname: "/devhub", href: `https://aevion.app/devhub${search}` },
    writable: true,
  });
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  адрес("");
});

describe("метка захода для записи проекта", () => {
  it("🔴 берётся СЫРАЯ метка целиком — она и называет ролик", async () => {
    адрес("?c=yt-chess-level");
    // Не «youtube»: канал отвечает «какая площадка», а нам нужно «какой ролик».
    expect(await (await свежая())()).toBe("yt-chess-level");
  });

  it("регистр приводится к одному — иначе один ролик станет двумя строками", async () => {
    адрес("?c=YT-Chess_Level");
    expect(await (await свежая())()).toBe("yt-chess_level");
  });

  it("🔴 метки нет — null, а не выдуманное значение", async () => {
    // Выдуманная метка хуже отсутствующей: по ней потом сделают вывод.
    expect(await (await свежая())()).toBeNull();
    адрес("?utm_source=telegram");
    expect(await (await свежая())()).toBeNull();
  });

  it("негодная метка не едет: это чужой ввод из адреса", async () => {
    const негодные = ["ролик-про-шахматы", 'probe-"user"', "yt chess", "y".repeat(61), "   "];
    for (const н of негодные) {
      адрес(`?c=${encodeURIComponent(н)}`);
      expect(await (await свежая())(), `пропустил негодную: ${н}`).toBeNull();
    }
    // Контроль: прибор не «всегда null» — ровно 60 знаков это годная метка.
    адрес(`?c=${"y".repeat(60)}`);
    expect((await (await свежая())())?.length, "граница 60 знаков отвергнута").toBe(60);
    expect(негодные.length, "знаменатель: проверено негодных видов").toBe(5);
  });

  it("🔴 наш проверочный заход опознаётся по ?probe= — не портя метку канала", async () => {
    // §0-НАШИ-ЗАХОДЫ: настоящая метка канала остаётся, наше окно во втором
    // параметре. Запись проекта получает «probe-…», и сервер снимет сайт сам.
    адрес("?c=ig&probe=user-99");
    expect(await (await свежая())()).toBe("ig");
    адрес("?probe=user-99");
    expect(await (await свежая())()).toBe("probe-user-99");
  });

  it("память вкладки подхватывает метку после перехода без неё", async () => {
    адрес("?c=yt-chess-level");
    const f = await свежая();
    expect(f()).toBe("yt-chess-level");
    // Человек пришёл на /devhub с ролика, потом нажал «Новый проект» — адрес
    // уже без метки. Без памяти источник терялся бы ровно на шаге сборки.
    адрес("");
    expect(f()).not.toBeNull();
  });

  it("на сервере (без window) не падает и не выдумывает", async () => {
    const было = globalThis.window;
    // @ts-expect-error — нарочно убираем window, как при отрисовке на сервере
    delete globalThis.window;
    try {
      expect(await (await свежая())()).toBeNull();
    } finally {
      globalThis.window = было;
    }
  });
});
