import { describe, test, expect, vi, afterEach } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { render, cleanup, waitFor } from "@testing-library/react";
import { ModuleMaturity } from "../ModuleMaturity";

/**
 * Плашка зрелости берёт статус ИЗ КАТАЛОГА и молчит, когда не знает.
 *
 * Повод (замер 06.09.2026): каталог называл 21 модуль «beta», а из 13
 * страниц бет слово о статусе несла одна — экран расходился с данными.
 * Класс: «страница честна своими словами, но каталога не читает».
 */

const APP = join(__dirname, "..", "..", "app");

// Двенадцать бет, получивших плашку 06.09. Список сверяется с исходниками:
// пропадёт вставка из layout — тест назовёт модуль поимённо.
const ПОДКЛЮЧЕНЫ = [
  "qrenew", "qreal", "qpersona", "qfusionai", "qtradeoffline", "qlife",
  "qgood", "psyapp-deps", "deepsan", "lifebox", "kids-ai-content", "qmelanin",
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function мокКаталога(modules: unknown) {
  vi.stubGlobal("fetch", async () => ({
    ok: true,
    json: async () => ({ modules }),
  }));
}

describe("плашка зрелости — из каталога", () => {
  test("beta из каталога даёт плашку со словом «Бета»", async () => {
    мокКаталога([{ id: "qlife", availability: "beta" }]);
    render(<ModuleMaturity id="qlife" />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("Бета");
    });
  });

  test("live из каталога НЕ даёт плашки — зрелый модуль о зрелости не докладывает", async () => {
    мокКаталога([{ id: "qlife", availability: "live" }]);
    const { container } = render(<ModuleMaturity id="qlife" />);
    // Дать эффекту отработать; затем убедиться, что ничего не появилось.
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe("");
  });

  test("каталог не ответил — честное молчание, а не выдуманный статус", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("сеть упала");
    });
    const { container } = render(<ModuleMaturity id="qlife" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe("");
  });

  test("незнакомое значение availability не рисуется как попало", async () => {
    // Каталог завтра может завести новое слово; плашка со старым словарём
    // обязана промолчать, а не показать сырой ключ человеку.
    мокКаталога([{ id: "qlife", availability: "half-broken" }]);
    const { container } = render(<ModuleMaturity id="qlife" />);
    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe("");
  });

  test.each(ПОДКЛЮЧЕНЫ)("layout модуля %s несёт плашку со СВОИМ id", (m) => {
    const p = join(APP, m, "layout.tsx");
    expect(existsSync(p), `${m}: layout.tsx исчез`).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src, `${m}: плашка пропала из layout`).toContain("ModuleMaturity");
    expect(src, `${m}: плашка стоит с чужим id — покажет статус другого модуля`).toContain(`id="${m}"`);
  });

  test("в компоненте нет захардкоженного статуса конкретного модуля", () => {
    const src = readFileSync(join(__dirname, "..", "ModuleMaturity.tsx"), "utf8");
    // Источник один — каталог. Появится «qrenew: beta» внутри компонента —
    // класс вернулся через чёрный ход.
    for (const m of ПОДКЛЮЧЕНЫ) {
      expect(src, `в компоненте зашит статус ${m}`).not.toContain(`"${m}"`);
    }
  });
});
