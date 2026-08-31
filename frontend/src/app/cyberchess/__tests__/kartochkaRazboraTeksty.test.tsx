import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PostGameCard from "../PostGameCard";
import { postGameSummary } from "../postGameSummary";
import type { PlyAnalysis } from "../postGameSummary";

/**
 * Четыре дефекта, найденные ГЛАЗАМИ на живом стенде 31.08.2026, когда 357
 * тестов модуля были зелёными. Все четыре — про текст, который читает
 * человек сразу после проигранной партии; ни один не падал.
 *
 * Тесты пишу по СЛЕДСТВИЮ («что увидит человек»), а не по форме кода:
 * иначе они закрепят сегодняшнюю запись, а не сегодняшний смысл.
 */

function partiya(n: number, kach: string): { hist: string[]; analysis: PlyAnalysis[] } {
  // Ходы игрока — чётные индексы (играет белыми), поэтому берём 2n ходов.
  const hist = Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? "e4" : "e5"));
  const analysis = hist.map((_, i) => ({
    move: i, cp: 0, mate: 0,
    quality: i % 2 === 0 ? kach : "good",
    cpLoss: 0,
  }));
  return { hist, analysis };
}

describe("подписи на карточке склоняются по числу", () => {
  // Второй десяток — отдельная ветка русского языка (11 берёт форму «многих»),
  // и именно до него доходит самый прилежный игрок.
  it.each([
    [1, "ошибка"], [2, "ошибки"], [5, "ошибок"], [11, "ошибок"], [22, "ошибки"],
  ])("%i → «%s»", (n, slovo) => {
    const { hist, analysis } = partiya(n, "mistake");
    render(<PostGameCard hist={hist} analysis={analysis} pCol="w" schitaem={false} />);
    expect(screen.getByText(slovo)).toBeTruthy();
  });

  it.each([[1, "зевок"], [2, "зевка"], [5, "зевков"]])("зевки: %i → «%s»", (n, slovo) => {
    const { hist, analysis } = partiya(n, "blunder");
    render(<PostGameCard hist={hist} analysis={analysis} pCol="w" schitaem={false} />);
    expect(screen.getAllByText(slovo).length).toBeGreaterThan(0);
  });
});

describe("совет «сильнее было» не повторяет сыгранный ход", () => {
  const hist = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Nf3", "d6"];
  const s = (best: string) =>
    postGameSummary(
      hist,
      hist.map((_, i) => ({
        move: i, cp: 0, mate: 0,
        quality: i === 4 ? "blunder" : "good",
        cpLoss: i === 4 ? 620 : 0,
        best: i === 4 ? best : undefined,
      })),
      "w",
    );

  it("совпал с сыгранным — совета нет", () => {
    // hist[4] === "Bc4": движок на шумной оценке отдаёт тот же ход, и человек
    // читал бы «сильнее было Bc4» про Bc4, который сам и сделал.
    expect(s("Bc4").perelom?.luchshe).toBeUndefined();
  });

  it("отличается — совет показан", () => {
    expect(s("Nf3").perelom?.luchshe).toBe("Nf3");
  });
});

describe("цена ошибки в пешках", () => {
  const perelom = (cpLoss: number, best?: string) => {
    const hist = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Nf3", "d6"];
    const { container } = render(
      <PostGameCard
        hist={hist}
        analysis={hist.map((_, i) => ({
          move: i, cp: 0, mate: 0,
          quality: i === 4 ? "blunder" : "good",
          cpLoss: i === 4 ? cpLoss : 0,
          best: i === 4 ? best : undefined,
        }))}
        pCol="w"
        schitaem={false}
      />,
    );
    return container.textContent ?? "";
  };

  it("целое число склоняется", () => {
    expect(perelom(600)).toContain("6 пешек");
    expect(perelom(200)).toContain("2 пешки");
    expect(perelom(100)).toContain("1 пешка");
  });

  it("дробное всегда «пешки» — по-русски оно не склоняется", () => {
    expect(perelom(620)).toContain("6.2 пешки");
    expect(perelom(150)).toContain("1.5 пешки");
  });

  it("между числом и точкой нет пробела", () => {
    // Было «потеряно 6.2 пешки . Сильнее было Nf6» — пробел приезжал из
    // JSX-фрагмента. Совет обязателен: без него ветка с точкой не
    // отрисовывается вовсе, и проверка зеленеет, ничего не проверив
    // (поймано мутацией — она пережила первую редакцию теста).
    const tekst = perelom(620, "Nf3");
    expect(tekst).toContain("Сильнее было Nf3.");
    expect(tekst).not.toContain(" .");
  });
});

describe("склонение в модуле одно", () => {
  it("postGameSummary берёт общий ccPlural, а не свою копию", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const put = path.join(process.cwd(), "src/app/cyberchess/postGameSummary.ts");
    // Контроль прибора: файл обязан читаться и быть непустым, иначе проверка
    // ниже даст успокаивающий «не содержит» на пустой строке.
    const src = fs.readFileSync(put, "utf8");
    expect(src.length).toBeGreaterThan(500);
    expect(src).toContain('from "./ccPlural"');
    // Своя копия правила — это второй способ делать то, что уже делается одним.
    expect(src).not.toContain("function sklonenie");
  });
});
