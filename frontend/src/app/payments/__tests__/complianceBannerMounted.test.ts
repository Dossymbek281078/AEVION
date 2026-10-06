import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Витрина Payments Rail обязана нести демо-пометку на КАЖДОЙ странице.
 *
 * 🔴 НАЙДЕНО 05.10.2026. /api/payments/v1 — демо (Next-роуты фронта, хранилище в
 * памяти, settlements засеяны, эквайрера нет — настоящая карта не проходит). А
 * layout витрины просто прокидывал children: метаданные обещают «settlements,
 * subscriptions, fraud, compliance reports», и ни одна страница payments/* не
 * говорила, что это демонстрация. Это ложное впечатление лицензированного
 * платёжного сервиса (0-ДЕНЬГИ п.3). Настоящие деньги идут через LemonSqueezy.
 *
 * Сторож читает исходник (layout — server component; рендер в jsdom тут лишний).
 */

const here = (p: string) => join(__dirname, p);

describe("витрина payments: демо-пометка на всех страницах", () => {
  const layout = readFileSync(here("../layout.tsx"), "utf8");

  it("layout монтирует ComplianceBanner варианта financial", () => {
    expect(layout).toMatch(/import\s+ComplianceBanner\s+from\s+["']@\/components\/ComplianceBanner["']/);
    expect(layout).toMatch(/<ComplianceBanner\s+variant=["']financial["']\s*\/>/);
  });

  it("КОНТРОЛЬ: баннер financial действительно говорит, что платежи не обрабатываются", () => {
    const banner = readFileSync(here("../../../components/ComplianceBanner.tsx"), "utf8");
    // Без этого контроля сторож зеленел бы, даже если текст баннера выхолостят.
    expect(banner).toContain("Реальные средства и платежи не обрабатываются");
    expect(banner).toMatch(/financial:\s*\{/);
  });
});
