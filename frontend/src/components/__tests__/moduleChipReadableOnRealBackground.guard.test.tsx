/**
 * Плашка цены читается на том фоне, где стоит: AA (≥ 4.5:1).
 *
 * ПОВОД (20.10.2026, прод, прибор multichat-…/kontrast.mjs): /multichat-engine зовёт
 * плашку с theme="dark", а страница светлая — «Входит в подписку AEVION» был
 * #e2e8f0 на #f8fafc, контраст 1.18:1. theme="dark" стоит на 30 страницах.
 * Теперь тему решает реальный фон под плашкой.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import ModulePricingChip from "../ModulePricingChip";
import { яркость, фонСветлыйПод } from "@/lib/fonPodElementom";

vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));

afterEach(() => cleanup());

const rgb = (c: string) => c.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number) as [number, number, number];
const контраст = (a: string, b: string) => {
  const L1 = яркость(...rgb(a)), L2 = яркость(...rgb(b));
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

async function цветТекста(фон: string, theme: "dark" | "light") {
  let root!: HTMLElement;
  await act(async () => {
    root = render(
      <div style={{ background: фон }}>
        <ModulePricingChip moduleId="multichat-engine" theme={theme} />
      </div>,
    ).container;
  });
  const чип = root.querySelector("div > span") as HTMLElement;
  return getComputedStyle(чип).color;
}

describe("плашка цены: тема по реальному фону", () => {
  it("theme=dark на светлой странице (#f8fafc) — текст ≥ 4.5:1", async () => {
    const цвет = await цветТекста("rgb(248, 250, 252)", "dark");
    expect(контраст(цвет, "rgb(248, 250, 252)")).toBeGreaterThanOrEqual(4.5);
  });

  it("КОНТРОЛЬ: theme=dark на тёмной странице (#0f172a) — светлый текст, ≥ 4.5:1", async () => {
    const цвет = await цветТекста("rgb(15, 23, 42)", "dark");
    expect(контраст(цвет, "rgb(15, 23, 42)")).toBeGreaterThanOrEqual(4.5);
    expect(яркость(...rgb(цвет))).toBeGreaterThan(0.5);
  });

  it("фон без цвета до самого верха — считается светлым (белая страница)", () => {
    const d = document.createElement("div");
    document.body.appendChild(d);
    expect(фонСветлыйПод(d)).toBe(true);
    d.remove();
  });
});
