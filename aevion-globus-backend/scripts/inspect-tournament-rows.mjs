// Что лежит в таблицах хранения турниров и задачи дня. Только читает.
// Заведён 13.08.2026: inspect-chess-rows.mjs смотрит кошельки, рейтинги и
// партии — то есть подтвердить удаление турнира им было нельзя вовсе.
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
// Ключ у таблиц разный, и первая версия зашила "id" — вторая таблица отвечала
// «column does not exist», а такую строку легко прочесть как «там пусто».
// Поэтому колонку спрашиваем у самой базы.
for (const table of ["CyberTournament", "CyberDailyEntry"]) {
  try {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,
      [table],
    );
    if (cols.rows.length === 0) {
      console.log(`${table}: таблицы нет`);
      continue;
    }
    const key = cols.rows[0].column_name;
    const r = await pool.query(`SELECT "${key}" FROM "${table}" ORDER BY "${key}"`);
    console.log(`${table} (${r.rows.length}), ключ «${key}»:`);
    for (const row of r.rows) console.log("  ", row[key]);
  } catch (e) {
    console.log(`${table}: НЕ ПРОЧИТАНА — ${e.message}`);
  }
}
await pool.end();
