import crypto from "crypto";
import { getPool } from "./dbPool";
import { isLifeBoxDbReady } from "./ensureLifeBoxTables";

/**
 * Ключ владельца псевдонима LifeBox.
 *
 * 🔴 Находка 12.10.2026 (окно Приложения-31.12, по коду, чужие данные не
 * трогались): «цифровой сейф» пускал по одному псевдониму. Кто угадал чужой
 * псевдоним (подсказка в поле — «my_future_self»), тот видел заголовки всех
 * капсул, текст открытых и мог их удалить. Секрета не было вовсе.
 *
 * Теперь: первая капсула НОВОГО псевдонима выдаёт ключ (показывается один
 * раз, хранится только хеш). Дальше чтение, открытие, удаление и новые
 * капсулы этого псевдонима — только с ключом в заголовке x-lifebox-key.
 *
 * Старые псевдонимы (капсулы есть, ключа нет) остаются как были — «legacy».
 * Выдать им ключ «первому, кто напишет» нельзя: так чужой захватил бы
 * псевдоним и запер владельца. Что делать со старыми — решение основателя.
 */

const memKeys = new Map<string, string>();
let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady || !isLifeBoxDbReady()) return;
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS lifebox_alias_keys (
      alias      TEXT PRIMARY KEY,
      key_hash   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tableReady = true;
}

function hash(key: string): string {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

async function storedHash(alias: string): Promise<string | null> {
  if (isLifeBoxDbReady()) {
    await ensureTable();
    const r = await getPool().query(`SELECT key_hash FROM lifebox_alias_keys WHERE alias=$1`, [alias]);
    return r.rows.length ? String(r.rows[0].key_hash) : null;
  }
  return memKeys.get(alias) ?? null;
}

export type KeyCheck = "ok" | "legacy" | "denied";

/** Есть ли у псевдонима ключ и подошёл ли предъявленный. */
export async function проверитьКлюч(alias: string, provided: unknown): Promise<KeyCheck> {
  const stored = await storedHash(alias);
  if (!stored) return "legacy";
  if (typeof provided !== "string" || !provided) return "denied";
  const a = Buffer.from(hash(provided), "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? "ok" : "denied";
}

/**
 * Выдать ключ псевдониму, у которого ещё нет ни ключа, ни капсул.
 * Возвращает ключ (показать человеку ОДИН раз) или null.
 * Гонка двух первых запросов решается базой: выигрывает один INSERT.
 */
export async function выдатьКлючНовому(alias: string, капсулДоЭтой: number): Promise<string | null> {
  if (капсулДоЭтой > 0) return null; // старый псевдоним — не захватываем
  const key = crypto.randomBytes(24).toString("base64url");
  if (isLifeBoxDbReady()) {
    await ensureTable();
    const r = await getPool().query(
      `INSERT INTO lifebox_alias_keys (alias, key_hash) VALUES ($1, $2)
       ON CONFLICT (alias) DO NOTHING RETURNING alias`,
      [alias, hash(key)],
    );
    return r.rows.length ? key : null;
  }
  if (memKeys.has(alias)) return null;
  memKeys.set(alias, hash(key));
  return key;
}

/** Только для тестов. */
export function __resetLifeboxKeysForTests(): void {
  memKeys.clear();
  tableReady = false;
}
