/**
 * Задачу дня можно РЕШИТЬ. На настоящем банке.
 *
 * Шестое доказательство появилось 19.08.2026 после дефекта, который прожил день
 * на проде при пяти зелёных проверках. Те спрашивали, ОТКУДА пришла задача и
 * различаются ли дни, — и честно отвечали «из банка» и «различаются». Ни одна не
 * спросила про содержимое, а решение приходило обрывками JSON (`["c5c3"` вместо
 * `c5c3`): задача не решалась, и ни одной ошибки при этом не возникало.
 *
 * Здесь проверяется ПРИГОДНОСТЬ, а не происхождение: позиция читается движком,
 * и вся линия решения проигрывается ход за ходом. Потребитель значения —
 * шахматный движок, поэтому и проверка его же руками.
 *
 * Только читает: ни одной записи в базу.
 *
 * Запуск:
 *   railway run --service Postgres sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" \
 *     npx ts-node-dev --transpile-only scripts/verify-daily-playable-live.ts'
 */
import { Pool } from "pg";
import { Chess } from "chess.js";

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Тот же выбор по дате, что и в маршруте: у всех игроков задача одна. */
function dayOffsetHash(day: string, total: number): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h) % Math.max(1, total);
}

/** Разбор такой же, как в маршруте: колонка — текст с JSON внутри. */
function parseSolution(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  const s = String(raw ?? "").trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const j: unknown = JSON.parse(s);
      if (Array.isArray(j)) return j.map(String).filter(Boolean);
    } catch { /* ниже разбор по разделителям */ }
  }
  return s.split(/[\s,]+/).filter(Boolean);
}

async function main(): Promise<number> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  let плохо = 0;
  try {
    const total: number = (await pool.query('SELECT count(*)::int AS n FROM "ChessPuzzle"')).rows[0].n;
    console.log("в банке задач:", total);
    if (!total) { console.log("  \u2717 банк пуст"); return 1; }

    // Сегодня и ещё шесть дней вперёд: дефект разбора проявился бы на любой,
    // но проверять одну — значит поверить одному примеру.
    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const off = dayOffsetHash(day, total);
      const row = (await pool.query(
        'SELECT "id","fen","sol" FROM "ChessPuzzle" ORDER BY "id" OFFSET $1 LIMIT 1', [off],
      )).rows[0];
      if (!row) { console.log(`  \u2717 ${day}: задачи нет`); плохо++; continue; }

      const sol = parseSolution(row.sol);
      if (!sol.length || !sol.every((m) => UCI.test(m))) {
        console.log(`  \u2717 ${day} ${row.id}: ходы не похожи на ходы: ${JSON.stringify(sol).slice(0, 60)}`);
        плохо++; continue;
      }

      let chess: Chess;
      try { chess = new Chess(String(row.fen)); }
      catch { console.log(`  \u2717 ${day} ${row.id}: позиция не читается движком`); плохо++; continue; }

      // Вся линия, а не первый ход: обрыв на третьем так же не даёт решить.
      let сыграно = 0;
      for (const m of sol) {
        let сделан = null;
        try { сделан = chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] || "q" }); } catch { сделан = null; }
        if (!сделан) break;
        сыграно++;
      }
      if (сыграно === sol.length) {
        console.log(`  \u2713 ${day} ${row.id}: позиция читается, вся линия из ${sol.length} ходов проигрывается`);
      } else {
        console.log(`  \u2717 ${day} ${row.id}: линия обрывается на ходу ${сыграно + 1} из ${sol.length} (${sol[сыграно]})`);
        плохо++;
      }
    }
    return плохо ? 1 : 0;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => { console.error("сорвалось:", e); process.exit(2); },
);
