import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Первое действие пути «Бюро → QRight» считается в воронке.
 *
 * Повод 13.10.2026 (воронка 14 дн.): mail-outreach|/bureau 10 + direct|/bureau 6 +
 * direct|/qright 6 живых сессий, «попробовали» 0 и «нажали» 0 — при этом ни CTA
 * «Защитить работу» на /bureau, ни создание сертификата на /qright не слали событий
 * (только PageTracking). Ноль был слепым пятном прибора, как у Мультичата (124).
 * Сторож по исходнику: событие стоит ДО запроса, у каждой ссылки на /qright — cta_click.
 */
const QRIGHT = readFileSync(join(process.cwd(), "src/app/qright/page.tsx"), "utf8");
const BUREAU = readFileSync(join(process.cwd(), "src/app/bureau/page.tsx"), "utf8");

describe("первое действие Бюро/QRight считается", () => {
  it("🔴 /qright: создание сертификата шлёт feature_use protect до POST /api/pipeline/protect", () => {
    expect(QRIGHT).toContain('import { track } from "@/lib/track";');
    const i = QRIGHT.indexOf('feature: "protect"');
    const j = QRIGHT.indexOf('fetch(apiUrl("/api/pipeline/protect")');
    expect(i, "событие protect есть").toBeGreaterThan(0);
    expect(j, "запрос protect есть").toBeGreaterThan(0);
    expect(i).toBeLessThan(j);
    expect(QRIGHT.slice(i - 60, i)).toContain('type: "feature_use"');
  });

  it("🔴 /bureau: каждая ссылка на /qright шлёт cta_click (знаменатель — число ссылок)", () => {
    expect(BUREAU).toContain('import { track } from "@/lib/track";');
    const ссылок = (BUREAU.match(/<Link href="\/qright"/g) || []).length;
    const сСобытием = (BUREAU.match(/<Link href="\/qright" onClick=\{\(\) => track\(\{ type: "cta_click", source: "bureau", meta: \{ product: "qright" \} \}\)\}/g) || []).length;
    expect(ссылок, "знаменатель: ссылок на /qright").toBeGreaterThanOrEqual(4);
    expect(сСобытием).toBe(ссылок);
  });
});
