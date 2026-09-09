import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Решение основателя 07.09.2026: «Глубокий анализ» (Stockfish 17.1 + NNUE) —
 * платная фича CyberChess Pro ($19). Всё остальное (игра, 500k задач, коуч,
 * ЛЁГКИЙ анализ, задача дня, турниры, варианты) — бесплатно. Раньше Pro не
 * открывал ничего (project_cyberchess_pro_gates_nothing) — теперь открывает
 * ровно это.
 *
 * Сторож держит гейт на месте: снять его (показать NNUE всем) — молчаливая
 * потеря выручки, которую не видно ни в одном прогоне продукта. Round-trip
 * прав проверен вручную: LS-вебхук пишет appSlug="cyberchess"
 * (appSlugForReference("app_cyberchess")=.slice(4)), а гейт читает тот же slug.
 *
 * Сорс-уровень: компонент клиентский, гейт — в его рендере (как economyIsHonest).
 */

const SRC = path.join(__dirname, "..", "DeepAnalysisPanel.tsx");
const src = () => fs.readFileSync(SRC, "utf-8").replace(/\s+/g, " ");

describe("Глубокий анализ закрыт за CyberChess Pro", () => {
  it("проверяется оплата модуля cyberchess", () => {
    // Именно слаг cyberchess — он совпадает с тем, что пишет платёжный вебхук.
    expect(src()).toMatch(/checkAppAccess\(\s*["']cyberchess["']\s*\)/);
  });

  it("не-владельцу показывается апселл, а не сам анализ", () => {
    const s = src();
    // Ветка «доступ не owned» существует и ведёт в кассу /pricing.
    expect(s).toMatch(/access\s*!==\s*["']owned["']/);
    // Адрес кассы принимается в ДВУХ формах: литералом и через keepChannel —
    // 08.09.2026 ссылка была обёрнута, чтобы метка канала переживала переход
    // (покупка с ролика иначе писалась бы в direct), и сторож, прибитый к
    // литералу, покраснел на ПОЧИНКЕ. Проверяем следствие — «ведёт в кассу»,
    // а не написание. Пустой адрес или другая страница по-прежнему падают.
    expect(s).toMatch(/href=(?:["']\/pricing["']|\{keepChannel\(\s*["']\/pricing["'])/);
    expect(s).toMatch(/CyberChess Pro/);
  });

  it("«unknown» не обвиняют в неоплате — предлагают вход (аноним мог купить)", () => {
    // appAccess.ts: unknown ≠ not-owned. Для unknown обязан быть путь входа.
    expect(src()).toMatch(/access\s*===\s*["']unknown["']/);
    expect(src()).toMatch(/\/auth\?next=\/cyberchess/);
  });
});
