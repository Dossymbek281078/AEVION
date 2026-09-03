import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bezKommentariev } from "./bezKommentariev";

/**
 * Панель партии писала «Движок: Stockfish 18 · d22» ВСЕГДА — и тогда, когда
 * движок не запустился.
 *
 * Замер 03.09.2026 на живом сайте: ноль реплик Stockfish по UCI, ход считает
 * запасной расчёт на JavaScript, человек ждёт соперника до двадцати секунд —
 * и всё это время читает имя движка, которого нет.
 *
 * Это тот же класс, что «задача дня из общего банка» при неответившем банке:
 * уверенная подпись, опровергаемая нашим же состоянием.
 */

const КОД = () => bezKommentariev(readFileSync(join(__dirname, "..", "page.tsx"), "utf8"));

describe("подпись движка", () => {
  it("зависит от того, запустился ли он", () => {
    const код = КОД();
    const i = код.indexOf("Движок:");
    expect(i, "строка «Движок:» пропала — проверку переписать").toBeGreaterThan(0);
    const кусок = код.slice(i, i + 260);
    expect(кусок).toContain("sfOk");
    expect(кусок).toContain("не запустился");
  });

  it("имя движка не стоит безусловным текстом", () => {
    const код = КОД();
    // Безусловное «Stockfish 18 · d22» рядом с «Движок:» — ровно то, что врало
    expect(код).not.toContain(">Движок: <b style={{color:CC.text}}>Stockfish");
  });

  it("признак готовности взводится по ответу самого движка", () => {
    const код = КОД();
    // sfOk обязан ставиться от ready() движка, а не по таймеру «наверное готов»
    expect(код).toMatch(/if\s*\(\s*s\.ready\(\)\s*\)\s*\{\s*sSfOk\(true\)/);
  });
});
