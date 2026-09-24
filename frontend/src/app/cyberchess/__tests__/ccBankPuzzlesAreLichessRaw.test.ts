// Банк задач отдаёт СЫРОЙ формат lichess (fen до хода соперника, sol[0] — ход соперника), а страница
// ждала «решающему ходить». Замер 22.09.2026 по 300 задачам прода: sol чётный 300/300, мат ставит
// не сторона fen 90/90, сторона fen теряет материал 159 раз. Человека просили сыграть ход соперника —
// слово основателя: «непонятные задачи с непонятными решениями».
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizePuzzle, isRawLichess, solverSide, razborZadachi, imyaPoResheniyu, goditsyaDlyaRush } from "../puzzleNormalize";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
// две настоящие задачи банка (GET /api/cyberchess-puzzles?limit=2, 22.09.2026)
const bank1 = { fen: "3qrb2/p5k1/1p2Bp2/4nPp1/P5P1/3p4/1P4Q1/2R2RK1 w - - 0 37", sol: ["c1c8", "d8d4", "g1h1", "e8c8"], name: "Вскрытое нападение · Средняя", r: 1358, theme: "Вскрытое нападение", side: "w" as const, goal: "Best move" as const };
const bank2 = { fen: "r2qk2r/5pp1/p2bbn1p/n1p1p3/2PpP3/P2B1NNP/1P1B1PP1/R2QK2R b KQkq - 2 14", sol: ["e6c4", "d3c4", "a5c4", "d1a4", "d8d7", "a4c4"], name: "Вилка · Сложная", r: 1909, theme: "Вилка", side: "b" as const, goal: "Best move" as const };
const rawMate = { fen: "6k1/5ppp/8/8/8/8/8/R5K1 b - - 0 1", sol: ["g8h8", "a1a8"], name: "x", r: 800, theme: "Мат", goal: "Mate" as const, mateIn: 1 };
const pageFormat = { fen: "7k/5ppp/8/8/8/8/8/R5K1 w - - 0 1", sol: ["a1a8"], name: "x", r: 800, theme: "Мат", goal: "Mate" as const, mateIn: 1 };

describe("сырой формат банка нормализуется", () => {
  it("чётный sol = сырой lichess; решает другая сторона", () => {
    expect(isRawLichess(bank1)).toBe(true); expect(solverSide(bank1)).toBe("b");
    expect(isRawLichess(bank2)).toBe(true); expect(solverSide(bank2)).toBe("w");
    expect(isRawLichess(pageFormat)).toBe(false); expect(solverSide(pageFormat)).toBe("w");
  });
  it("после нормализации ходить решающему, sol нечётный, ход соперника запомнен", () => {
    const n = normalizePuzzle(bank1);
    expect(n.fen.split(" ")[1]).toBe("b"); expect(n.sol).toEqual(["d8d4", "g1h1", "e8c8"]); expect(n.side).toBe("b"); expect(n.setupMove?.san).toBe("Rc8");
    expect(normalizePuzzle(pageFormat)).toBe(pageFormat); // формат страницы не трогаем
  });
  it("разбор по ходам: выигрыш ладьи за 2 хода; вилка выигрывает фигуру; мат в 1 в обоих форматах", () => {
    expect(razborZadachi(bank1)).toEqual({ kind: "material", moves: 2, gain: 5 });
    expect(imyaPoResheniyu(bank1)).toBe("Выигрыш ладьи за 2 хода");
    const r2 = razborZadachi(bank2); expect(r2?.kind).toBe("material"); expect(r2 && r2.kind === "material" ? r2.gain : 0).toBeGreaterThanOrEqual(3);
    expect(imyaPoResheniyu(rawMate)).toBe("Мат в 1"); expect(imyaPoResheniyu(pageFormat)).toBe("Мат в 1");
  });
  it("годность для раша: мат ≤3 и короткий выигрыш — да; длинная позиционная — нет", () => {
    expect(goditsyaDlyaRush(bank1)).toBe(true); expect(goditsyaDlyaRush(rawMate)).toBe(true);
    expect(goditsyaDlyaRush({ ...bank1, sol: ["c1c8", "d8d4", "g1h1", "e8c8", "h1g1", "c8e8", "g1h1", "e8c8", "h1g1", "c8e8", "g1h1", "c8e8"] })).toBe(false);
  });
  it("страница нормализует во ВСЕХ четырёх загрузчиках и задачу дня с сервера", () => {
    expect(page).toContain("const pz0=fPz[0];if(!pz0)return;const pz=normalizePuzzle(pz0);");
    expect(page).toContain("const pz=normalizePuzzle(PUZZLES[dailyState.idx]||PUZZLES[0]);");
    expect(page).toContain("const pz0=fPz[i]||PUZZLES[0];const pz=pz0?normalizePuzzle(pz0):pz0;");
    expect(page).toContain("const pick=normalizePuzzle(pick0);");
    expect(page).toContain("const pz=normalizePuzzle(fPz[idx]);"); // пятый загрузчик: смена фильтра/режима (найден 24.09)
    expect(page).toContain("fen:npd.fen,sol:npd.sol,");
    expect(page).not.toMatch(/sPzCurrent\(pz\)[^\n]*\n[^\n]*const pz=fPz\[i\]\|\|PUZZLES\[0\];/);
  });
  it("задача не подменяется при догрузке пула", () => {
    expect(page).toContain('if(pzCurrent&&pzAttempt==="idle"&&выборЗадачиRef.current===ключВыбора){выборЗадачиRef.current=ключВыбора;return;}');
    expect(page).toContain('const ключВыбора=[pzFilterGoal,pzFilterMate,pzFilterPhase,pzFilterTheme,pzFilterSide,tab,pzMode,rushDuration,pzCustomSec].join("|");');
  });
  it("фильтр по стороне и подписи — по решающему и по ходам; раш — из годных задач", () => {
    expect(page).toContain('solverSide(p)!==pzFilterSide');
    expect(page).toContain("const goalLabel=imyaPoResheniyu(pz)||");
    expect(page).toContain("{pzCurrent.side===\"w\"?\"⚪\":\"⚫\"} {pzTitle}");
    expect(page).toContain("if(pzMode===\"rush\"){let k=0;while(k<30&&list[idx]&&!goditsyaDlyaRush(list[idx]))");
    expect(page.match(/ldPz\(rushStartIdx\(\)\)/g)?.length).toBe(2);
  });
});

describe("фишки задачи без повторов", () => {
  it("фаза, тема и мат-фишка дедуплицируются и не повторяют заголовок", () => {
    expect(page).toContain('.filter((t,i,a)=>t&&a.indexOf(t)===i&&t!==pzTitle.replace(/^[⚪⚫]\\s*/,""))');
    // старый вид (две фишки без дедупа, мат отдельной строкой) не должен вернуться
    expect(page).not.toContain('{[fazaRu(pzCurrent.phase),temaZadachiRu(pzCurrent.theme)].filter(Boolean).map(');
  });
});
