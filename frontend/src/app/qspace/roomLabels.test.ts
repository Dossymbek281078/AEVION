import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { назначенияПоПодписям, подписиИзТекста, roomTypeFromLabel } from "./roomLabels";
import type { ЭлементТекста } from "./dimensionScale";

/**
 * Подпись побуквенно, как пишет CAD: порядок в потоке — порядок чтения.
 * mirrored — как в LA VIE: первая буква стоит правее всех (позиции зеркальны).
 */
function буквами(text: string, x: number, y: number, size = 2, mirrored = false): ЭлементТекста[] {
  const chars = [...text];
  return chars.map((c, i) => ({
    str: c,
    transform: [size, 0, 0, size, x + (mirrored ? chars.length - 1 - i : i) * size * 0.6, y],
    width: size * 0.6,
  }));
}

describe("подписи комнат из букв PDF", () => {
  it("буквы одной строки собираются в слово", () => {
    const п = подписиИзТекста(буквами("Кухня", 100, 200));
    expect(п.map((x) => x.text)).toEqual(["Кухня"]);
    expect(п[0].x).toBeCloseTo(103, 0);
  });

  it("зеркальные позиции глифов (как в LA VIE) читаются по порядку потока, не по x", () => {
    const п = подписиИзТекста(буквами("Кухня", 100, 200, 2, true));
    expect(п.map((x) => x.text)).toEqual(["Кухня"]);
  });

  it("две строки одной подписи склеиваются сверху вниз: «Мастер» над «спальня»", () => {
    const п = подписиИзТекста([...буквами("спальня", 100, 200), ...буквами("Мастер", 100, 202.6)]);
    expect(п.map((x) => x.text)).toEqual(["Мастер спальня"]);
  });

  it("два слова в строке — через пробел; далёкие подписи — отдельно; цифры не подписи", () => {
    const п = подписиИзТекста([
      ...буквами("Детский", 100, 200), ...буквами("санузел", 110.5, 200),
      ...буквами("Холл", 300, 50),
      ...буквами("1400", 200, 120),
    ]);
    expect(п.map((x) => x.text).sort()).toEqual(["Детский санузел", "Холл"]);
  });

  it("повёрнутый текст (размеры вдоль стен) пропускается", () => {
    const п = подписиИзТекста([{ str: "Кухня", transform: [0, 2, -2, 0, 50, 50], width: 6 }]);
    expect(п).toEqual([]);
  });

  it("типы по словарю: санузел, кухня, спальни и детская, гостиная, холл/гардероб/прачечная; мебель — null", () => {
    expect(roomTypeFromLabel("Детский санузел")).toBe("bath");
    expect(roomTypeFromLabel("Кухня")).toBe("kitchen");
    expect(roomTypeFromLabel("Мастер спальня")).toBe("bedroom");
    expect(roomTypeFromLabel("Спальня сына")).toBe("bedroom");
    expect(roomTypeFromLabel("Гостиная")).toBe("living");
    expect(roomTypeFromLabel("Холл")).toBe("hall");
    expect(roomTypeFromLabel("Гардероб дочери")).toBe("hall");
    expect(roomTypeFromLabel("Прачечная")).toBe("hall");
    expect(roomTypeFromLabel("термомикс")).toBeNull();
    expect(roomTypeFromLabel("РАССТАНОВКА МЕБЕЛИ")).toBeNull();
  });
});

const ПАПКА = process.env.QSPACE_EXAMPLES ?? "C:/Users/user/OneDrive/Desktop/АЕВИОН/21-QSpace-3D-модельер/примеры";
const LAVIE = `${ПАПКА}/LA VIE.pdf`;

describe.skipIf(!existsSync(LAVIE))("LA VIE.pdf: подписи комнат", () => {
  it("находятся кухня, холл, мастер спальня, детский санузел, гардероб, прачечная", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(LAVIE)), isEvalSupported: false, disableFontFace: true }).promise;
    const tc = await (await doc.getPage(1)).getTextContent();
    await doc.destroy();
    const items = tc.items.flatMap((it) => ("str" in it ? [{ str: it.str, transform: it.transform, width: it.width }] : []));
    const тексты = подписиИзТекста(items).map((p) => p.text.toLowerCase());
    for (const ожид of ["кухня", "холл", "мастер спальня", "детский санузел", "гардероб", "прачечная", "мастер санузел"]) {
      expect(тексты.some((t) => t.includes(ожид)), `нет «${ожид}» среди: ${тексты.join(" | ")}`).toBe(true);
    }
    const комнатных = тексты.filter((t) => roomTypeFromLabel(t) !== null);
    expect(комнатных.length).toBeGreaterThanOrEqual(8);
  }, 60_000);
});

describe("назначенияПоПодписям", () => {
  it("подпись ставит тип комнате по roomAt; первая выигрывает; без типа — не трогает; вне комнат — в unplaced", () => {
    const roomAt = (x: number, y: number) => (x < 5 ? 1 : y < 5 ? 2 : null);
    const r = назначенияПоПодписям(
      [
        { text: "Кухня", x: 20, y: 20 },        // (1,1) → комната 1
        { text: "полки", x: 20, y: 20 },        // без типа
        { text: "Холл", x: 30, y: 20 },         // (2,1) → комната 1, уже занята
        { text: "Мастер спальня", x: 70, y: 20 }, // (6,1) → комната 2
        { text: "Гардероб", x: 70, y: 70 },     // (6,6) → нигде
      ],
      { x: 10, y: 10 }, 0.1, roomAt,
    );
    expect(r.types).toEqual({ 1: "kitchen", 2: "bedroom" });
    expect(r.names).toEqual({ 1: "Кухня", 2: "Мастер спальня" });
    expect(r.unplaced).toEqual(["Гардероб"]);
  });
  it("подпись на границе (в клетке стены, до комнаты 0.2 м) уходит ближайшей комнате; дальше 0.4 м — вне", () => {
    const roomAt = (x: number, y: number) => (x >= 1 && x <= 3 && y >= 1 && y <= 3 ? 7 : null);
    const r = назначенияПоПодписям(
      [{ text: "Прачечная", x: 8, y: 20 }, { text: "Гардероб", x: 0, y: 20 }], // (0.8,2) — в 0.2 м от комнаты; (0,2) — в 1 м
      { x: 0, y: 0 }, 0.1, roomAt,
    );
    expect(r.names).toEqual({ 7: "Прачечная" });
    expect(r.unplaced).toEqual(["Гардероб"]);
  });
});
