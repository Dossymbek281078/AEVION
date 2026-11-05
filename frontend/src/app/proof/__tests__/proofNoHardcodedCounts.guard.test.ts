import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 5.11.2026: /proof держал «42 signatures, 20 revoked» с замера 11.10; на проде уже 70/35.
// Число подписей в реестре на странице — только живое (из API), не вписанное руками.
describe("/proof без захардкоженных чисел реестра", () => {
  const t = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
  it("нет «N signatures in the live registry / N revoked»", () => {
    expect(t).not.toMatch(/<b>\d+ signatures<\/b>/);
    expect(t).not.toMatch(/<b>\d+ of them revoked<\/b>/);
    expect(t).not.toMatch(/Those \d+ signatures/);
  });
  it("не называет подпись постквантовой боевой", () => {
    expect(t).not.toMatch(/quantum-grade|quantum-resistant/i);
    expect(t).toMatch(/post-quantum signature is in preview/);
  });
});
