// Замер 2.11.2026 на проде: гость /qsign ~1 с видел красное «нет связи» при живом API —
// чип показывался, пока проба /health ещё шла (health === null). Красное — только при настоящем сбое.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("/qsign: чип «нет связи» не горит, пока проба здоровья идёт", () => {
  it("сбой пробы ставит healthFailed", () => {
    expect(src).toMatch(/\.catch\(\(\) => \{ setHealth\(null\); setHealthFailed\(true\); \}\)/);
    expect(src).toMatch(/const \[healthFailed, setHealthFailed\] = useState\(false\)/);
  });
  it("чип offline стоит под условием healthFailed, а не под «health пуст»", () => {
    expect(src).toMatch(/\{!health && healthFailed && \(\s*<span[^>]*>\{t\("hero\.offline"\)\}<\/span>\s*\)\}/);
    expect(src).not.toMatch(/\) : \(\s*<span style=\{chip\("rgba\(239,68,68,0\.18\)", "#fecaca"\)\}>\{t\("hero\.offline"\)\}/);
  });
});
