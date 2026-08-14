import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RegulatorySourceChip } from "../RegulatorySourceChip";
import { translations } from "@/lib/i18n-data";

// Чип отвечает на вопрос «чьё это правило» — то есть ровно то место, где
// формулировка обязана выдерживать проверку регулятором. 10.08.2026 живая
// сверка с фидом FAA дала расклад, при котором прежняя фраза была неверна:
// снимок — редакция 7/9/2026, фид публикует 8/6/2026, изменённых ячеек ноль.
// Дрейфа нет (маршрутизация верна), но и «снимок совпадает с тем, что публикует
// регулятор» сказать уже нельзя: совпадают потолки, а не редакция.
//
// `t` подменён так, чтобы возвращать КЛЮЧ: тест проверяет выбор формулировки,
// а не её текст — иначе он ломался бы от любой редактуры. Сами тексты
// проверяются отдельно, в тесте словаря ниже.
vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key}(${Object.values(vars).join(",")})` : key,
  }),
}));

function tooltipText() {
  fireEvent.mouseEnter(screen.getByRole("button"));
  return screen.getByRole("tooltip").textContent ?? "";
}

const BASE = {
  tier: "official" as const,
  authority: "FAA",
  title: "UAS Facility Map",
  effective: "7/9/2026",
};

describe("RegulatorySourceChip — свежесть источника", () => {
  it("переиздание без изменения потолков не выдаётся за совпадение со снимком", () => {
    render(
      <RegulatorySourceChip
        source={{ ...BASE, upToDate: true, publishedEffective: "8/6/2026" }}
      />,
    );
    const text = tooltipText();
    expect(text).toContain("reg.tip.reissued");
    expect(text).toContain("8/6/2026"); // называем редакцию регулятора, а не только свою
    expect(text).not.toContain("reg.tip.fresh");
    expect(text).not.toContain("reg.tip.drift"); // это НЕ дрейф — чинить нечего
  });

  it("совпавшая редакция остаётся обычным «сверено»", () => {
    render(
      <RegulatorySourceChip
        source={{ ...BASE, upToDate: true, publishedEffective: "7/9/2026" }}
      />,
    );
    const text = tooltipText();
    expect(text).toContain("reg.tip.fresh");
    expect(text).not.toContain("reg.tip.reissued");
  });

  it("без живой сверки редакция регулятора не додумывается", () => {
    render(<RegulatorySourceChip source={{ ...BASE, upToDate: null, publishedEffective: null }} />);
    const text = tooltipText();
    expect(text).toContain("reg.tip.unchecked");
    expect(text).not.toContain("reg.tip.reissued");
    expect(text).not.toContain("reg.tip.fresh");
  });

  it("источник-документ не обещает сверки, которой не бывает", () => {
    // Астана и Токио стоят на eAIP/растровом слое: опрашивать нечего.
    // «Сверка ещё не выполнялась» читалось бы как «скоро выполним».
    render(
      <RegulatorySourceChip
        source={{
          tier: "official",
          authority: "Казаэронавигация / AIP KZ",
          effective: "AIRAC 2026-05-14",
          upToDate: null,
          noLiveFeed: true,
          lastReviewed: "2026-07-26",
        }}
      />,
    );
    const text = tooltipText();
    expect(text).toContain("reg.tip.nofeed.reviewed");
    expect(text).toContain("2026-07-26");
    expect(text).not.toContain("reg.tip.unchecked");
  });

  it("документ без даты сверки не выдумывает её", () => {
    render(
      <RegulatorySourceChip
        source={{ tier: "official", authority: "AIP KZ", upToDate: null, noLiveFeed: true }}
      />,
    );
    const text = tooltipText();
    expect(text).toContain("reg.tip.nofeed");
    expect(text).not.toContain("reg.tip.nofeed.reviewed");
    expect(text).not.toContain("reg.tip.unchecked");
  });

  it("реальный дрейф по-прежнему просит обновить данные и получает ⚠", () => {
    render(
      <RegulatorySourceChip
        source={{ ...BASE, upToDate: false, publishedEffective: "8/6/2026" }}
      />,
    );
    expect(tooltipText()).toContain("reg.tip.drift");
    // Маркер — единственный сигнал «нужно действие», он не должен исчезнуть.
    expect(screen.getByText(/⚠/)).toBeInTheDocument();
  });
});

describe("словарь: формулировка переиздания есть на всех трёх языках", () => {
  // Гейт i18n-parity в CI проверяет наличие ключей, но не то, что подстановка
  // редакции не потерялась при переводе — без {edition} фраза снова стала бы
  // общей и недоказуемой.
  for (const lang of ["en", "ru", "kk"] as const) {
    it(`${lang} — ключи есть и несут свои подстановки`, () => {
      const dict = (translations as Record<string, Record<string, string>>)[lang];
      expect(dict["reg.tip.reissued"]).toBeDefined();
      expect(dict["reg.tip.reissued"]).toContain("{edition}");
      expect(dict["reg.tip.nofeed"]).toBeDefined();
      expect(dict["reg.tip.nofeed.reviewed"]).toBeDefined();
      expect(dict["reg.tip.nofeed.reviewed"]).toContain("{reviewed}");
    });
  }
});
