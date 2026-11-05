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

// Расширение 5.11: те же ложные обещания защиты по всему сайту (название «Quantum Shield» — не обещание, его не трогаем).
import { readdirSync, statSync } from "node:fs";
function обойти(d: string, out: string[] = []): string[] {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== "__tests__" && n !== "node_modules") обойти(p, out); }
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}
const ПО_САЙТУ = /quantum[- ]grade|quantum-resistant|post-quantum-ready|квантового уровня|кванттық деңгей|Постквантовая криптографическая защита|Post-Quantum Cryptographic Layer|Post-quantum cryptographic protection/i;
describe("по всему сайту нет обещания квантовой защиты без боевой подписи", () => {
  it.skipIf(ПОДПИСЬ_ПОСТКВАНТОВАЯ_БОЕВАЯ)("src без quantum-grade / quantum-resistant / post-quantum-ready / «постквантовая защита»", () => {
    const src = join(dir, "..", "..");
    const плохие = обойти(src).filter((f) => ПО_САЙТУ.test(readFileSync(f, "utf8")));
    expect(плохие).toEqual([]);
  });
});
