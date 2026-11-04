import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 4.11.2026 (слово основателя): продавец с ключом мог списать деньги с ЛЮБОГО
 * кошелька по UUID без согласия владельца (IDOR по id кошелька). Прямое
 * списание — только со своих кошельков или при явном флаге среды.
 */
const src = readFileSync(join(__dirname, "..", "src", "routes", "qpaynet.ts"), "utf8");
const start = src.indexOf('qpaynetRouter.post("/merchant/charge"');
const handler = src.slice(start, src.indexOf("qpaynetRouter.", start + 10));

describe("merchant/charge не списывает с чужого кошелька без согласия", () => {
  it("гейт согласия стоит ДО списания и читает owner_id кошелька", () => {
    expect(start).toBeGreaterThan(0);
    const gate = handler.indexOf('throw new HttpError(403, "customer_consent_required")');
    const debit = handler.indexOf("SET balance = balance - $1");
    expect(gate, "гейта согласия нет").toBeGreaterThan(0);
    expect(gate).toBeLessThan(debit);
    expect(handler).toMatch(/SELECT id, owner_id, balance, status FROM qpaynet_wallets WHERE id=ANY\(\$1\)/);
    expect(handler).toMatch(/from\.owner_id !== mk\.rows\[0\]\.owner_id && !directMerchantChargeAllowed\(\)/);
  });
  it("флаг — явный QPAYNET_ALLOW_DIRECT_MERCHANT_CHARGE=1, по умолчанию выключен", () => {
    expect(src).toMatch(/process\.env\.QPAYNET_ALLOW_DIRECT_MERCHANT_CHARGE === "1"/);
  });
});
