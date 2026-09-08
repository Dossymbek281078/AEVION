import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Текст страницы не должен отставать от продукта.
 *
 * Повод: страница сутки писала «скан и JPEG пока не распознаются», когда
 * распознавание уже работало и было подключено. Занижение так же вредно, как
 * завышение: человек уходит, не попробовав то, что мы умеем. Проза не
 * проверяется ничем и потому стареет молча — здесь она проверяется КОДОМ.
 */
const DIR = __dirname;
const client = readFileSync(path.join(DIR, "_client.tsx"), "utf8");

/** Существует ли возможность в коде (по факту импорта и вызова). */
function moduleWired(file: string, symbol: string): boolean {
  const src = readFileSync(path.join(DIR, file), "utf8");
  return src.length > 0 && client.includes(symbol);
}

describe("страница описывает продукт таким, какой он есть", () => {
  it("распознавание картинки работает — значит текст обязан его называть", () => {
    expect(moduleWired("raster.ts", "RasterReview"), "экран правки не подключён").toBe(true);
    expect(/JPEG|картинк/i.test(client), "страница не упоминает картинки").toBe(true);
    // и НЕ должна утверждать обратное
    expect(/не распознаются[^\n]{0,40}(скан|JPEG)|(скан|JPEG)[^\n]{0,40}пока не распознаются/i.test(client))
      .toBe(false);
  });

  it("приём файлов на странице совпадает с тем, что описано словами", () => {
    const accept = /accept="([^"]+)"/.exec(client)?.[1] ?? "";
    expect(accept).toContain(".dxf");
    expect(accept).toContain(".pdf");
    expect(accept).toContain("image/");
    // каждому формату из accept — упоминание в тексте
    expect(/DXF/.test(client)).toBe(true);
    expect(/PDF/.test(client)).toBe(true);
    expect(/JPEG|PNG|картинк/i.test(client)).toBe(true);
  });

  it("границы названы: масштаб спрашиваем, проёмы не распознаём", () => {
    expect(/спросим у вас|укажите|назов[её]те/i.test(client), "не сказано, что масштаб спрашиваем").toBe(true);
    expect(/Окна и двери из чертежа не распознаются/i.test(client)).toBe(true);
  });

  it("разводка названа черновиком, а не проектом", () => {
    expect(/черновик по типовым нормам/i.test(client)).toBe(true);
    expect(/не проектная\s+документация/i.test(client)).toBe(true);
  });

  it("экспорт GLB подключён — значит кнопка обязана быть, и наоборот", () => {
    const wired = /GLTFExporter/.test(client) && /exportGlb/.test(client);
    const shown = /Скачать модель \(GLB\)/.test(client);
    expect(wired, "экспортёр не подключён").toBe(true);
    expect(shown, "экспорт есть в коде, но кнопки нет — человек о нём не узнает").toBe(true);
    // экспортируются только видимые слои: иначе в файл уедет то, чего
    // человек не видел на экране
    expect(/gRough\.visible/.test(client) && /gDecor\.visible/.test(client)).toBe(true);
  });

  it("сохранение подключено — значит кнопки и объяснение обязаны быть", () => {
    expect(/saveLocal|loadLocal/.test(client), "сохранение не подключено").toBe(true);
    expect(/Сохранить проект/.test(client), "нет кнопки сохранения — человек о ней не узнает").toBe(true);
    expect(/Открыть проект/.test(client), "нет кнопки открытия файла").toBe(true);
    // и честная граница: хранение в браузере — удобство, надёжен файл
    expect(/выгрузите файлом|выгружен файлом|Для надёжности/i.test(client)).toBe(true);
  });

  it("площади помещений считаются — значит и показаны, и допущение названо", () => {
    expect(/findRooms/.test(client), "комнаты не подключены").toBe(true);
    expect(/Помещения<\/h2>|Помещение \{/.test(client), "нет блока помещений на странице").toBe(true);
    // допущение про стены обязано быть рядом с числами, а не только в коде
    expect(/БЕЗ вычета окон и дверей/i.test(client)).toBe(true);
  });

  it("проверка прохода подключена — значит замечания доходят до экрана", () => {
    expect(/checkPassage/.test(client), "проход не проверяется").toBe(true);
    // замечания прохода обязаны попадать в тот же список, что и остальные:
    // иначе они посчитаются и никому не покажутся
    expect(/pass\.issues\.map/.test(client), "замечания прохода не доходят до списка").toBe(true);
  });

  it("контроль прибора: выдуманная фраза на странице НЕ находится", () => {
    expect(/сертифицированное проектное решение/i.test(client)).toBe(false);
  });
});

describe("метаописание страницы обещает только то, что есть", () => {
  // Описание в metadata человек видит РАНЬШЕ самой страницы — в поиске и в
  // ссылке, которой делятся. Его не проверял никто: сторожа смотрели текст
  // на экране, а метаописание живёт в page.tsx и в разметке для поисковика.
  const page = readFileSync(path.join(__dirname, "page.tsx"), "utf8");
  const client = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
  const файл = (имя: string) => readFileSync(path.join(__dirname, имя), "utf8");

  const ПАРЫ: Array<[string, RegExp, () => boolean]> = [
    ["векторный PDF", /векторный PDF/i, () => файл("pdf.ts").includes("FlateDecode")],
    ["фотография плана", /фотографию плана/i, () => файл("raster.ts").length > 500],
    ["чертёж AutoCAD", /чертёж AutoCAD \(DXF\)/i, () => файл("dxf.ts").includes("LWPOLYLINE")],
    // ⚠️ Признак — ОТРИСОВКА и ВЫЗОВ, а не имя. Имя стоит ещё и в импорте,
    // поэтому проверка `includes("CoolingPanel")` переживала удаление самой
    // панели: одно вхождение из двух оставалось. Мутацией и вскрылось — уже
    // третий раз за окно наступаю на одно и то же правило.
    ["тёплый пол", /тёплый пол/i, () => client.includes("<HeatingPanel")],
    ["вентиляция", /вентиляц/i, () => client.includes("<VentilationPanel")],
    ["мощность сплита", /мощность сплит/i, () => client.includes("<CoolingPanel")],
    ["чертёж сверху", /чертёж\s+сверху/i, () => client.includes("floorPlanSvg(plan")],
  ];

  it("каждое обещание метаописания подкреплено кодом", () => {
    const пустые: string[] = [];
    for (const [имя, вОписании, вКоде] of ПАРЫ) {
      if (вОписании.test(page) && !вКоде()) пустые.push(имя);
    }
    expect(пустые, "метаописание обещает то, чего в коде нет").toEqual([]);
  });

  it("контроль прибора: сверка НЕ пустая — хотя бы половина пар сработала", () => {
    // без этого «ноль пустых обещаний» неотличимо от «ни одна пара не совпала»
    const сработали = ПАРЫ.filter(([, вОписании]) => вОписании.test(page)).length;
    expect(сработали, "ни одно обещание не найдено в описании — сверять нечего")
      .toBeGreaterThanOrEqual(4);
  });
});
