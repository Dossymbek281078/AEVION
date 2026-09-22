import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import RequestCard from "../components/RequestCard";

/**
 * Страница за платной стеной обязана пережить ОТКАЗ своей же ручки.
 *
 * Замер на проде 22.09.2026: `qfusionai` входит в PAYWALL_MODULES, поэтому
 * гостю все его ручки отвечают 402 с телом {error:"upgrade_required",…}.
 * Компонент разбирал это тело как статистику — `stats` становился непустым
 * объектом БЕЗ поля `topProviders`, и `stats?.topProviders[0]` падал на
 * undefined[0]. Необязательная цепочка обрывалась на первом звене и не
 * защищала второе. Падение ловила общая граница ошибок, и посетитель видел
 * «Что-то пошло не так» ВМЕСТО предложения купить — то есть платная стена
 * выглядела поломкой продукта ровно для того человека, который мог заплатить.
 *
 * Здесь проверяется не текст и не вёрстка, а единственное, что нужно: отказ
 * не роняет отрисовку. Предложение купить показывает общий <PaywallModal>.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ответ(статус: number, тело: unknown) {
  vi.stubGlobal("fetch", async () => ({
    ok: статус >= 200 && статус < 300,
    status: статус,
    json: async () => тело,
  }));
}

describe("модуль за платной стеной переживает отказ ручки", () => {
  it("402 с телом отказа не роняет отрисовку", async () => {
    ответ(402, { error: "upgrade_required", requiredPlan: "pro", module: "qfusionai" });
    await act(async () => {
      render(<RequestCard />);
    });
    expect(document.body.textContent).toBeTruthy();
  });

  // Контроль в другую сторону: на НОРМАЛЬНОМ ответе компонент по-прежнему
  // читает данные. Без этого тест был бы зелёным и на компоненте, который
  // вообще ничего не показывает.
  it("нормальный ответ по-прежнему разбирается", async () => {
    ответ(200, {
      source: "db",
      total: 7,
      byStrategy: [{ strategy: "auto", cnt: 7 }],
      avgLatencyMs: 120,
      topProviders: [{ provider: "openai", cnt: 7 }],
      recent: [],
    });
    await act(async () => {
      render(<RequestCard />);
    });
    expect(document.body.textContent).toContain("7");
  });

  // Третий случай, найденный тем же контролем: форма пришла ПОЛОВИНЧАТОЙ
  // (код 200, но без части полей). Раньше такой ответ падал не в месте
  // получения, а глубже — по byStrategy. Теперь он считается «не данными».
  it("половинчатая форма не роняет отрисовку", async () => {
    ответ(200, { total: 3 });
    await act(async () => {
      render(<RequestCard />);
    });
    expect(document.body.textContent).toBeTruthy();
  });
});
