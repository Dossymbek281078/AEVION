import { describe, it, expect } from "vitest";
import { tochnostSohranennoy, postGameSummary } from "../postGameSummary";
import { calibrateFromGames, type SavedGameForCPI } from "../ratingCalibration";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * «Точность» человек видит в ТРЁХ местах: карточка разбора, график на
 * странице, панель FIDE. До 31.08.2026 считалась она тремя способами —
 * график давал частичный зачёт неточностям (0.6) и ошибкам (0.3), поэтому
 * для одной и той же партии два наших числа расходились. Верить будут
 * тому, что показано короче и увереннее, а он-то и врал.
 */

const hody = (kach: string[]) => kach.map((quality, ply) => ({ ply, quality }));

describe("точность считается одним способом", () => {
  it("совпадает с числом на карточке разбора для той же партии", () => {
    // Белые: ходы 0,2,4,6 — два точных, зевок и ошибка → 50%.
    const kach = ["good", "blunder", "brilliant", "good", "blunder", "good", "mistake", "good"];
    const hist = kach.map(() => "e4");
    const analysis = kach.map((quality, move) => ({ move, quality, cp: 0, mate: 0, cpLoss: 0 }));

    const naKartochke = postGameSummary(hist, analysis, "w").tochnost;
    const naGrafike = tochnostSohranennoy(hody(kach), "w");
    expect(naGrafike).toBe(naKartochke);
    // Ходы белых: good, brilliant, blunder, mistake → (0.85+1+0+0.3)/4 = 54%.
    expect(naGrafike).toBe(54);
  });

  it("зависит от цвета игрока", () => {
    const kach = ["good", "blunder", "good", "blunder"];
    expect(tochnostSohranennoy(hody(kach), "w")).toBe(85);
    expect(tochnostSohranennoy(hody(kach), "b")).toBe(0);
  });

  it("нет ходов игрока — честное «не знаю», а не 50", () => {
    // Ровная середина неотличима от замера: раньше здесь подставлялась 50,
    // и график рисовал точку, за которой не стояло ничего.
    expect(tochnostSohranennoy([{ ply: 1, quality: "good" }], "w")).toBeNull();
    expect(tochnostSohranennoy([], "w")).toBeNull();
  });

  it("частичный зачёт у неточности и ошибки — как во всём модуле", () => {
    // Веса не выдуманы: ровно те, что стоят в пяти местах page.tsx.
    // Зевок — ноль, и это единственный ярлык без зачёта вовсе.
    expect(tochnostSohranennoy(hody(["inacc", "x", "inacc", "x"]), "w")).toBe(60);
    expect(tochnostSohranennoy(hody(["mistake", "x", "mistake", "x"]), "w")).toBe(30);
    expect(tochnostSohranennoy(hody(["blunder", "x", "blunder", "x"]), "w")).toBe(0);
    expect(tochnostSohranennoy(hody(["brilliant", "x", "great", "x"]), "w")).toBe(100);
  });

  it("веса совпадают с пятью формулами, уже стоящими на странице", () => {
    // Не «похожи», а совпадают: иначе человек снова увидит два числа об одном.
    const src = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
    // Ищем УМНОЖЕНИЕ на 0.85, а не имя переменной: имена у пяти формул
    // разные (goo, good, oppGo, go), и шаблон по имени видел только три из
    // пяти — то есть занижал охват собственного замера.
    const shtuk = (src.match(/\*0\.85/g) || []).length;
    expect(shtuk).toBe(5); // ровно пять формул; станет меньше — их свели
    for (const kach of ["brilliant", "great", "good", "inacc", "mistake", "blunder"]) {
      const nash = tochnostSohranennoy(hody([kach, "x"]), "w")! / 100;
      const ih = { brilliant: 1, great: 1, good: 0.85, inacc: 0.6, mistake: 0.3, blunder: 0 }[kach]!;
      expect(nash).toBeCloseTo(ih, 2);
    }
  });
});

describe("страница берёт общий расчёт, а не свой", () => {
  const src = () => readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");

  it("график зовёт tochnostSohranennoy", () => {
    const s = src();
    expect(s.length).toBeGreaterThan(100000); // контроль: файл прочитан целиком
    expect(s).toContain("tochnostSohranennoy(g.analysis!,g.playerColor)");
  });

  it("подпись по-русски, а не «ACC»", () => {
    const s = src();
    expect(s).toContain("Точность <b style={{color:col2}}>{last2}%</b>");
    expect(s).not.toContain(">ACC <b");
  });

  it("пустой список не даёт «undefined%» на экране", () => {
    expect(src()).toContain("if(!accs.length)return null;");
  });
});

describe("панель FIDE и карточка сходятся на одной партии", () => {
  it("партия из одних точных ходов высока в обоих местах", () => {
    const kach = Array.from({ length: 80 }, (_, i) => (i % 2 === 0 ? "good" : "blunder"));
    const igra = {
      moves: kach.map(() => "e4"),
      result: "You win",
      rating: 1500,
      tc: "5+0",
      playerColor: "w",
      analysis: kach.map((quality, ply) => ({ ply, quality: quality as never, cpLoss: 0 })),
    } as SavedGameForCPI;
    const panel = calibrateFromGames([igra, igra, igra]).accuracyPct;
    const grafik = tochnostSohranennoy(igra.analysis!, "w")!;
    // Оба считают точность ХОДОВ ИГРОКА, но разными формулами: панель —
    // долей точных, экран — с частичным зачётом. Требовать совпадения нельзя,
    // а вот расходиться на порядок они не должны: партия из одних хороших
    // ходов обязана быть высокой в обоих местах.
    expect(panel).toBeGreaterThan(80);
    expect(grafik).toBeGreaterThan(80);
  });
});
