import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PostGameCard from "../PostGameCard";
import type { PlyAnalysis } from "../postGameSummary";

/**
 * Что человек ВИДИТ сразу после партии. Логику считает postGameSummary и её
 * проверяет свой тест; здесь проверяется другое — доходит ли посчитанное до
 * экрана и не показывает ли карточка нули, пока анализ ещё идёт.
 */
const a = (quality: string, cpLoss: number, best?: string): PlyAnalysis =>
  ({ move: 0, cp: 0, mate: 0, quality, cpLoss, best });

describe("карточка разбора после партии", () => {
  it("пока анализ идёт — говорит об этом, а не показывает нули", () => {
    render(<PostGameCard hist={["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]} analysis={[]} pCol="w" schitaem />);
    expect(screen.getByText(/Разбираю партию/)).toBeTruthy();
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it("короткая партия объясняет, почему разбора нет", () => {
    // молчать нельзя: человек только что видел разбор у прошлой партии и
    // решит, что сломалось. Проверяем именно объяснение, а не пустоту
    render(<PostGameCard hist={["e4"]} analysis={[]} pCol="w" schitaem={false} />);
    expect(screen.getByTestId("post-game-card-short").textContent).toContain("слишком короткая");
  });

  it("показывает точность, зевки и переломный ход с альтернативой", () => {
    const hist = ["e4", "e5", "Nf3", "Nc6", "Qh5", "g6"];
    const an = [a("good", 0), a("good", 0), a("good", 0), a("good", 0), a("blunder", 320, "Bc4"), a("good", 0)];
    render(<PostGameCard hist={hist} analysis={an} pCol="w" schitaem={false} />);

    expect(screen.getByTestId("post-game-card")).toBeTruthy();
    expect(screen.getByText(/67%/)).toBeTruthy();      // 2 хороших из 3 ходов белых
    // Один зевок — «зевок», не «зевков». Прежняя редакция требовала «зевков»
    // и тем закрепляла дефект: подписи фишек не склонялись вовсе.
    expect(screen.getByText("зевок")).toBeTruthy();
    const perelom = screen.getByText(/Где решилась партия/).parentElement!;
    expect(perelom.textContent).toContain("Qh5");
    expect(perelom.textContent).toContain("3.2");
    expect(perelom.textContent).toContain("Bc4");
  });

  it("чистая партия не выдумывает недостатков", () => {
    const hist = ["e4", "e5", "Nf3", "Nc6"];
    const an = [a("good", 0), a("good", 0), a("brilliant", 0), a("good", 0)];
    render(<PostGameCard hist={hist} analysis={an} pCol="w" schitaem={false} />);
    // «блестящи» встречается и во фразе, и в чипе — берём карточку целиком
    expect(screen.getByTestId("post-game-card").textContent).toContain("блестящ");
    expect(screen.queryByText(/Где решилась партия/)).toBeNull();
  });
});
