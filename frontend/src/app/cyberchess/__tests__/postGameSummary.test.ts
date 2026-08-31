import { describe, it, expect } from "vitest";
import { postGameSummary, odnaFraza, hodIgroka, type PlyAnalysis } from "../postGameSummary";

/**
 * Разбор партии сразу после её конца. Главная опасность здесь — посчитать
 * ходы СОПЕРНИКА как свои: тогда «твои зевки» разбавятся его ошибками, и
 * разбор соврёт в самую приятную для игрока сторону.
 */
const a = (quality: string, cpLoss: number, best?: string): PlyAnalysis =>
  ({ move: 0, cp: 0, mate: 0, quality, cpLoss, best });

describe("глагол согласуется с числом ошибок", () => {
  // Увидено на живой сборке в первом же настоящем разборе: существительное
  // склонялось, глагол остался во множественном — «1 ошибка стоили позиции».
  const fraza = (oshibok: number) =>
    odnaFraza({ vsego: 10, tochnyh: 5, netochnostey: 0, oshibok, zevkov: 0,
                blestyashchih: 0, tochnost: 50, perelom: null });

  it("одна ошибка — стоила", () => {
    expect(fraza(1)).toContain("1 ошибка стоила позиции");
  });

  it("две — стоили", () => {
    expect(fraza(2)).toContain("2 ошибки стоили позиции");
  });

  it("пять — стоили", () => {
    expect(fraza(5)).toContain("5 ошибок стоили позиции");
  });

  it("двадцать одна — снова стоила", () => {
    // Второй десяток и «21» ведут себя по-разному; ловим обе ветки.
    expect(fraza(21)).toContain("21 ошибка стоила позиции");
    expect(fraza(11)).toContain("11 ошибок стоили позиции");
  });
});

describe("чей ход разбираем", () => {
  it("белые ходят чётными полуходами, чёрные нечётными", () => {
    expect(hodIgroka(0, "w")).toBe(true);
    expect(hodIgroka(1, "w")).toBe(false);
    expect(hodIgroka(0, "b")).toBe(false);
    expect(hodIgroka(1, "b")).toBe(true);
  });

  it("ошибки соперника НЕ попадают в разбор игрока", () => {
    // игрок белыми сыграл идеально, чёрные зевнули дважды
    const hist = ["e4", "??", "Nf3", "??"];
    const an = [a("good", 0), a("blunder", 400), a("good", 0), a("blunder", 500)];
    const s = postGameSummary(hist, an, "w");
    expect(s.vsego).toBe(2);
    expect(s.zevkov).toBe(0);
    // 85, а не 100: точность считается с частичным зачётом — той же
    // формулой, что и в пяти местах page.tsx. Хороший ход весит 0.85,
    // единицу дают только brilliant и great.
    expect(s.tochnost).toBe(85);
  });
});

describe("счёт и точность", () => {
  it("считает каждый вид качества", () => {
    const hist = ["a", "x", "b", "x", "c", "x", "d", "x"];
    const an = [a("brilliant", 0), a("good", 0), a("inacc", 60), a("good", 0),
                a("mistake", 150), a("good", 0), a("blunder", 400), a("good", 0)];
    const s = postGameSummary(hist, an, "w");
    expect([s.vsego, s.blestyashchih, s.netochnostey, s.oshibok, s.zevkov]).toEqual([4, 1, 1, 1, 1]);
    // brilliant 1 + inacc 0.6 + mistake 0.3 + blunder 0 = 1.9 из 4 → 48%.
    // Прежние 25% были долей точных ходов — расчёт, которого в модуле больше
    // нет: он расходился с тем, что человек видит на других экранах.
    expect(s.tochnost).toBe(48);
  });

  it("пустой разбор не выдумывает чисел", () => {
    const s = postGameSummary([], [], "w");
    expect(s.vsego).toBe(0);
    expect(s.tochnost).toBeNull();
    expect(s.perelom).toBeNull();
  });
});

describe("переломный момент", () => {
  it("берёт самый дорогой ход игрока и считает номер хода", () => {
    const hist = ["e4", "e5", "Nf3", "Nc6", "Qh5", "g6"];
    const an = [a("good", 0), a("good", 0), a("good", 0), a("good", 0), a("blunder", 320, "Bc4"), a("good", 0)];
    const s = postGameSummary(hist, an, "w");
    expect(s.perelom).not.toBeNull();
    expect(s.perelom!.nomerHoda).toBe(3);   // пятый полуход = третий ход белых
    expect(s.perelom!.zapis).toBe("Qh5");
    expect(s.perelom!.poterya).toBe(3.2);
    expect(s.perelom!.luchshe).toBe("Bc4");
  });

  it("мелкая потеря переломом не считается — это шум оценки", () => {
    const hist = ["e4", "e5"];
    const an = [a("inacc", 30), a("good", 0)];
    expect(postGameSummary(hist, an, "w").perelom).toBeNull();
  });
});

describe("фраза, которую человек читает первой", () => {
  const s = (o: Partial<ReturnType<typeof postGameSummary>>) =>
    odnaFraza({ vsego: 10, tochnyh: 10, netochnostey: 0, oshibok: 0, zevkov: 0,
                blestyashchih: 0, tochnost: 100, perelom: null, ...o });

  it("чистая партия не выдумывает недостатков", () => {
    expect(s({})).toContain("без грубых ошибок");
  });

  it("зевки названы прямо и склоняются верно", () => {
    expect(s({ zevkov: 1 })).toContain("1 зевок");
    expect(s({ zevkov: 3 })).toContain("3 зевка");
    expect(s({ zevkov: 5 })).toContain("5 зевков");
  });

  it("короткая партия честно говорит, что разбирать нечего", () => {
    expect(odnaFraza(postGameSummary([], [], "w"))).toContain("слишком короткая");
  });
});
