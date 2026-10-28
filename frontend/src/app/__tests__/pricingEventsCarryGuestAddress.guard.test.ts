import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/*
 * 28.10.2026 (окно «Продукт», находка Науки через Оркестратора). События воронки
 * /api/pricing/events уходили на бэк через rewrite без адреса гостя — бэк видел выход
 * прокси Vercel (305 событий/час с 3–4 адресов). Обработчик сайта под /api-backend
 * несёт адрес с ключом (guestIpProxy.проксироватьСАдресом). Мутация 28.10: удалить
 * обработчик → красный (проверено).
 */
const ФАЙЛ = join(process.cwd(), "src/app/api-backend/api/pricing/events/route.ts");

describe("события воронки несут адрес гостя", () => {
  test("🔴 обработчик /api-backend/api/pricing/events существует и проксирует POST с адресом", () => {
    expect(existsSync(ФАЙЛ)).toBe(true);
    const s = readFileSync(ФАЙЛ, "utf8");
    expect(s).toContain('from "@/lib/guestIpProxy"');
    expect(s).toMatch(/export async function POST\([^)]*\)[^{]*\{\s*return проксироватьСАдресом\(req, путь\(req\)\);/);
    expect(s).toContain('export const dynamic = "force-dynamic";');
  });
  test("track() шлёт события именно на /api/pricing/events (иначе обработчик мимо)", () => {
    const track = readFileSync(join(process.cwd(), "src/lib/track.ts"), "utf8");
    expect(track).toContain('apiUrl("/api/pricing/events")');
  });
});
