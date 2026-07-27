import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { COACH_KNOWLEDGE } from "../coachKnowledge";
import { LESSONS } from "../coachLessons";

/* Each of these positions is loaded onto the board when the player opens the card, and
   `bestMove` is the answer the lesson is teaching. Thirteen of the knowledge positions
   and one lesson exercise shipped with a move that cannot be played there at all — a
   bishop asked to reach a square of the other colour, a rook standing on the square it
   was told to move to, a FEN with nine squares in a rank, two positions with no white
   king. The board would either refuse to load or refuse every answer.

   Nothing about that is visible by reading the file, so it is asserted here. */

type Row = { where: string; fen?: string; bestMove?: string; solution?: string; text?: string };

const knowledgeRows: Row[] = COACH_KNOWLEDGE.flatMap((cat) =>
  cat.entries.map((e) => ({
    where: `${cat.id}/${e.id}`,
    fen: e.fen,
    bestMove: e.bestMove,
    solution: e.solution,
    text: e.explanation,
  })),
);

const lessonRows: Row[] = LESSONS.flatMap((l) =>
  l.steps.map((s, i) => ({ where: `${l.id}[${i}]`, fen: s.fen, bestMove: s.bestMove, text: s.body })),
);

const withFen = [...knowledgeRows, ...lessonRows].filter((r) => r.fen);

describe("coach teaching positions", () => {
  it("ships a good number of them", () => {
    expect(withFen.length).toBeGreaterThan(50);
  });

  it("every position loads on a real board", () => {
    const bad: string[] = [];
    for (const r of withFen) {
      try {
        new Chess(r.fen);
      } catch (e) {
        bad.push(`${r.where}: ${(e as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every taught move can be played in the position it is taught from", () => {
    const bad: string[] = [];
    for (const r of withFen.filter((x) => x.bestMove)) {
      let legal: string[];
      try {
        legal = new Chess(r.fen).moves().map((m) => m.replace(/[+#]/g, ""));
      } catch {
        continue; // already reported by the test above
      }
      if (!legal.includes(r.bestMove!.replace(/[+#!?]/g, ""))) {
        bad.push(`${r.where}: ${r.bestMove}`);
      }
    }
    expect(bad).toEqual([]);
  });

  /* Дебютная карточка заявляет номер хода прямо в FEN. Больше ходов, чем номер
     позволяет, в позиции быть не может — так нашлись две испорченные диаграммы:
     у Испанки белая ладья стояла на g1 при короле на e1 (четыре хода в позиции
     «после третьего»), а у Староиндийского начала чёрные не сделали НИ ОДНОГО хода,
     хотя очередь была их. У этюдов счётчик всегда 1 — они номера не заявляют. */
  it("shows opening positions that fit the move number they claim", () => {
    const startSquares = new Map<string, string>();
    for (const row of new Chess().board()) {
      for (const sq of row) if (sq) startSquares.set(sq.square, sq.color + sq.type);
    }

    const bad: string[] = [];
    for (const r of knowledgeRows.filter((x) => x.fen)) {
      const parts = r.fen!.split(" ");
      const full = Number(parts[5]);
      if (!Number.isFinite(full) || full < 2) continue; // счётчик 1 = этюд
      let c: Chess;
      try {
        c = new Chess(r.fen);
      } catch {
        continue;
      }
      const now = new Map<string, string>();
      for (const row of c.board()) {
        for (const sq of row) if (sq) now.set(sq.square, sq.color + sq.type);
      }
      const moved = { w: 0, b: 0 };
      for (const [sq, piece] of startSquares) {
        if (now.get(sq) !== piece) moved[piece[0] as "w" | "b"]++;
      }
      const gone = {
        w: 16 - [...now.values()].filter((p) => p[0] === "w").length,
        b: 16 - [...now.values()].filter((p) => p[0] === "b").length,
      };
      // взятая фигура тоже освобождает свою клетку — её вычитаем из числа сдвигов
      const budget = { w: full, b: parts[1] === "w" ? full - 1 : full };
      for (const side of ["w", "b"] as const) {
        const other = side === "w" ? "b" : "w";
        if (moved[side] - gone[other] > budget[side]) {
          bad.push(`${r.where}: ${side === "w" ? "белых" : "чёрных"} сдвигов ${moved[side]}, а ход всего ${full}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  /* Текст объяснения — это то, что игрок читает рядом с доской, и цитируемые в нём ходы
     не проверял никто. Двух не существовало: «1.b5!» в прорыве, где поле b5 занято чужой
     пешкой, и «1.Ke5!» в оппозиции, где короли встали бы вплотную. Карточка, ведущая
     рассказ от начала партии («1.e4» в дебютной), — не ошибка, и отличается тем, что
     такой ход играется из НАЧАЛЬНОЙ позиции, а не из позиции карточки. */
  it("only quotes moves that exist on the board it shows", () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const RU: [string, string][] = [["Кр", "K"], ["К", "N"], ["Л", "R"], ["С", "B"], ["Ф", "Q"]];
    const strip = (s: string) => s.replace(/[+#!?;.,)»"]+$/u, "");
    const toLatin = (t: string) => {
      for (const [ru, en] of RU) if (t.startsWith(ru)) return en + t.slice(ru.length);
      return t;
    };
    const playable = (fen: string, san: string) => {
      try {
        return new Chess(fen).moves().some((x) => strip(x) === strip(san));
      } catch {
        return false;
      }
    };

    const bad: string[] = [];
    for (const r of [...knowledgeRows, ...lessonRows].filter((x) => x.fen && x.text)) {
      const isBlack = /\b1\s*\.\s*\.\s*\./.test(r.text!);
      const m = isBlack
        ? /\b1\s*\.\s*\.\s*\.\s*([^\s,!?);]+)/.exec(r.text!)
        : /\b1\.(?!\.)\s*([^\s,!?);]+)/.exec(r.text!);
      if (!m) continue;
      const mover = r.fen!.split(" ")[1];
      if ((isBlack && mover !== "b") || (!isBlack && mover !== "w")) continue;

      const san = strip(toLatin(m[1]));
      if (!/^([KQRBN][a-h1-8x]|[a-h][1-8x]|O-O)/.test(san) || san.includes("-")) continue; // проза, не нотация
      if (playable(r.fen!, san)) continue;
      if (playable(START, san)) continue; // рассказ от начала партии, а не про эту доску
      bad.push(`${r.where}: в тексте «1.${m[1]}», но такого хода в позиции нет`);
    }
    expect(bad).toEqual([]);
  });

  /* Сверка с таблицей окончаний показала три карточки, где показанный ход просто
     подставлял фигуру: в «ферзь против короля» 1.Фd5+? Крxd5 — вместо мата ничья, в
     «двух слонах» 1.Сd3? Крxd3 — то же самое. Ход при этом легален, позиция возможна,
     разбор играется — все прежние тесты молчали. Здесь считается материал после
     лучшего взятия соперника; жертва разрешена, только если за ней следует мат. */
  it("never teaches a move that simply hangs a piece", () => {
    const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const material = (c: Chess, side: "w" | "b") =>
      c
        .board()
        .flat()
        .reduce((s, sq) => (sq ? s + (sq.color === side ? VAL[sq.type] : -VAL[sq.type]) : s), 0);

    const bad: string[] = [];
    for (const r of [...knowledgeRows, ...lessonRows].filter((x) => x.fen && x.bestMove)) {
      let c: Chess;
      try {
        c = new Chess(r.fen);
      } catch {
        continue;
      }
      const side = c.turn();
      const before = material(c, side);
      let moved;
      try {
        moved = c.move(r.bestMove!.replace(/[!?]/g, ""));
      } catch {
        continue; // ловит соседний тест
      }
      for (const cap of c.moves({ verbose: true }).filter((m) => m.to === moved.to)) {
        const t = new Chess(c.fen());
        t.move(cap.san);
        const answers = t.moves({ verbose: true });
        /* Жертва — это ход, за который платят продолжением: взятием обратно на том же
           поле, шахом или матом. Если ничего из этого нет, фигуру просто отдали. */
        const paidFor =
          answers.some((m) => m.to === moved.to) || answers.some((m) => /[+#]/.test(m.san));
        if (paidFor) continue;
        if (before - material(t, side) >= 2) {
          bad.push(`${r.where}: после ${r.bestMove} соперник играет ${cap.san} и остаётся с материалом`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  /* `solution` печатается игроку дословно как «правильный разбор». Восемь из тринадцати
     разборов остались от прежних, уже заменённых позиций: они называли ходы, которых на
     этой доске нет — ладью на h3, короля на d5, взятие давно исчезнувшей фигуры. Ход
     bestMove при этом был легален, поэтому соседний тест их не видел. Здесь вариант
     проигрывается на доске от начала до конца. */
  it("plays every taught solution line out on the board", () => {
    const bad: string[] = [];
    for (const r of knowledgeRows.filter((x) => x.fen && x.solution)) {
      const moves = r
        .solution!.split("(")[0] // хвост в скобках — альтернатива, не главный вариант
        .split(/\s+/)
        .map((t) => t.replace(/^\d+\.+/, "").trim())
        .filter((t) => t && /^[KQRBNa-h]/.test(t) && !/^(мост|wins)$/.test(t));
      const c = new Chess(r.fen);
      for (const san of moves) {
        try {
          c.move(san);
        } catch {
          bad.push(`${r.where}: «${r.solution}» — ход ${san} на этой доске невозможен`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  /* A position with the side to move already delivering check is not a puzzle, it is a
     bug in the setup — the opponent's king would be capturable. chess.js rejects those
     outright, so this only guards the subtler case of a legal-but-nonsensical board. */
  it("never asks the player to move from a finished position", () => {
    const bad: string[] = [];
    for (const r of withFen) {
      let c: Chess;
      try {
        c = new Chess(r.fen);
      } catch {
        continue;
      }
      if (c.isGameOver()) bad.push(`${r.where}: партия уже окончена`);
    }
    expect(bad).toEqual([]);
  });

  /* chess.js грузит позицию, где сторона БЕЗ хода стоит под шахом — в партии такая
     возникнуть не может, короля просто взяли бы. Три карточки такими и были: ладья или
     пешка держали чужого короля под боем не в свой ход. Ловится переворотом очереди
     хода: если после переворота шах — позиция невозможна. */
  it("никогда не ставит под шах сторону, которая не ходит", () => {
    const bad: string[] = [];
    for (const r of withFen) {
      const flipped = r.fen!.replace(/ (w|b) /, (_m, t) => ` ${t === "w" ? "b" : "w"} `);
      let c: Chess;
      try {
        c = new Chess(flipped);
      } catch {
        continue;
      }
      if (c.inCheck()) bad.push(`${r.where}: под шахом сторона, которая не ходит`);
    }
    expect(bad).toEqual([]);
  });

  it("gives every knowledge entry a unique id inside its category", () => {
    for (const cat of COACH_KNOWLEDGE) {
      const ids = cat.entries.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("lessons", () => {
  it("has unique ids", () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /* A prerequisite naming a lesson that does not exist would lock the course silently. */
  it("names prerequisites that exist and come earlier", () => {
    const byId = new Map(LESSONS.map((l) => [l.id, l]));
    for (const l of LESSONS) {
      if (!l.prerequisite) continue;
      const prev = byId.get(l.prerequisite);
      expect(prev, `${l.id} требует несуществующий ${l.prerequisite}`).toBeDefined();
      expect(prev!.num).toBeLessThan(l.num);
    }
  });

  it("numbers the lessons without gaps or repeats", () => {
    const nums = LESSONS.map((l) => l.num).sort((a, b) => a - b);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
});
