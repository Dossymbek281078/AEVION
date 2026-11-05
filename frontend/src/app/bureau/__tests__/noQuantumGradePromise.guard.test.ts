import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// 5.11.2026: /bureau обещал «защиту квантового уровня», а боевой постквантовой подписи нет:
// прод отвечает /health → qsign.mode = "preview" (seed_unset), бюро подписывает Ed25519
// (/api/bureau/health → notarySignature: "ed25519"). Пока ML-DSA не боевая, таких слов в бюро быть не должно.
// УСЛОВИЕ СНЯТИЯ: когда на проде qsign.mode станет "real" — выставить ПОДПИСЬ_ПОСТКВАНТОВАЯ_БОЕВАЯ = true.
const ПОДПИСЬ_ПОСТКВАНТОВАЯ_БОЕВАЯ = false;

const dir = join(__dirname, "..");
const файлы = ["page.tsx", "bureauText.ts", "launch/page.tsx"];
const ЗАПРЕЩЕНО = /quantum[- ]grade|квантового уровня|кванттық деңгей/i;

describe("бюро не обещает «квантовый уровень» без боевой постквантовой подписи", () => {
  it.skipIf(ПОДПИСЬ_ПОСТКВАНТОВАЯ_БОЕВАЯ)("в текстах бюро нет quantum-grade / квантового уровня / кванттық деңгей", () => {
    for (const f of файлы) {
      expect(readFileSync(join(dir, f), "utf8"), f).not.toMatch(ЗАПРЕЩЕНО);
    }
  });
  it("фактическая формулировка на месте на ru и kk", () => {
    const t = readFileSync(join(dir, "bureauText.ts"), "utf8");
    expect(t).toMatch(/постквантовая подпись — в предпросмотре/);
    expect(t).toMatch(/постквантты қолтаңба — алдын ала қарауда/);
  });
});
