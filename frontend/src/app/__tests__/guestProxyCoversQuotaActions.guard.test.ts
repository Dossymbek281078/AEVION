/**
 * 🔴 30.10.2026 (окно Приложения-2·Бюро), прибор на проде 04f65bbb7: /api/veilnetx/inspect
 * через aevion.app/api-backend отдаёт ip = 3.126.121.238 (узел Vercel; Railway перезаписывает
 * X-Forwarded-For адресом соединения), напрямую — адрес человека. /health:
 * guestIpFromSite accepted 368 / noKey 9426 — почти все запросы идут перезаписью без подписи.
 * POST /api/pipeline/protect (регистрация на /qright, норма 3/мес) обработчика не имел →
 * ключ нормы = «ip:<узел Vercel>», общий на всех гостей: 4-й гость ЛЮБОЙ за месяц получал стену.
 *
 * Сторож: у каждого действия с бесплатной нормой на бэке (PAID_ACTIONS: bureau_verify,
 * healthai_check, qright_register, qventure_analyze, startup_publish) есть обработчик
 * app/api-backend/<путь>/route.ts, зовущий проксироватьСАдресом с тем же путём.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_BACKEND = join(HERE, "..", "api-backend");

// Путь бэкенда → действие (aevion-globus-backend: учестьДействие(req, "<действие>")).
const ДЕЙСТВИЯ_С_НОРМОЙ: Array<[string, string]> = [
  ["/api/pipeline/protect", "qright_register (routes/pipeline.ts POST /protect)"],
  ["/api/pipeline/protect-batch", "qright_register (routes/pipeline.ts POST /protect-batch)"],
  ["/api/qright/objects", "qright_register (routes/qright.ts POST /objects)"],
  ["/api/bureau/verify/start", "bureau_verify (routes/bureau.ts)"],
  ["/api/healthai/check", "healthai_check"],
  ["/api/qventure/analyze", "qventure_analyze"],
];

describe("каждое действие с бесплатной нормой идёт через подписанный обработчик сайта", () => {
  for (const [путь, действие] of ДЕЙСТВИЯ_С_НОРМОЙ) {
    it(`${путь} — ${действие}`, () => {
      const файл = join(API_BACKEND, ...путь.split("/").filter(Boolean), "route.ts");
      expect(existsSync(файл), `нет обработчика ${файл}: запрос уйдёт перезаписью с адресом узла Vercel`).toBe(true);
      const текст = readFileSync(файл, "utf8");
      expect(текст).toContain("проксироватьСАдресом");
      expect(текст, "обработчик проксирует не тот путь").toContain(`"${путь}"`);
      expect(текст).toContain('export const dynamic = "force-dynamic"');
    });
  }

  it("GET /api/qright/objects не потерян: route.ts перекрывает перезапись для всех методов", () => {
    const текст = readFileSync(join(API_BACKEND, "api", "qright", "objects", "route.ts"), "utf8");
    expect(текст).toMatch(/export async function GET/);
  });
});
