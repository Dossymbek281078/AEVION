import { join } from "node:path";

/**
 * Путь к журналу заявок leads.jsonl — тот же, что у routes/pricing.ts (LEADS_FILE →
 * том Railway → data/leads.jsonl). Вынесен отдельно (129, 13.10.2026): импорт
 * routes/pricing ради одной функции тянул весь модуль цен, и сторож ручки заказа
 * пилота висел 35 с на его загрузке.
 */
export function leadsFile(): string {
  const fromEnv = process.env.LEADS_FILE?.trim();
  if (fromEnv) return fromEnv;
  const mount = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (mount) return join(mount, "leads.jsonl");
  return join(process.cwd(), "data", "leads.jsonl");
}
