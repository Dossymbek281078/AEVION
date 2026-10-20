/*
 * Сторож перевода личных ручек на verifyBearerLive (20.10.2026).
 *
 * Повод: после DELETE /api/auth/account старый токен ещё 7 дней отдавал личные
 * данные — verifyBearerOptional не смотрит deletedAt и AuthSession.revokedAt.
 * Ручки ниже отдают ЛИЧНЫЕ данные вошедшего (его записи, проекты, сессии,
 * настройки, выгрузки). Поведенчески помощник проверен в
 * exportRejectsDeletedAndRevoked.test.ts; здесь — что каждая из 119 ручек
 * по-прежнему зовёт его, а не голую проверку подписи. Откат одной строки
 * в любой из них краснит этот файл.
 *
 * Знаменатель: verifyBearerOptional(req) в src/routes/ на cde01b698 — 553
 * вызова в 36 файлах; переведено 119 в 4 файлах + 2 ручки auth.ts
 * (там свой requireAuth, см. requireAuthLive).
 */
import { describe, test, expect } from "vitest";
import fs from "fs";
import path from "path";

const ЛИЧНЫЕ: Record<string, string[]> = {
  "pipeline.ts": [
    "GET /certificates/export.zip",
  ],
  "qright.ts": [
    "GET /objects",
    "GET /objects/:id/stats",
    "GET /webhooks",
    "GET /webhooks/:id/deliveries",
  ],
  "devhub.ts": [
    "GET /projects",
    "GET /projects/:id",
    "GET /projects/:id/files",
    "GET /projects/:id/files/:filepath",
    "GET /projects/:id/file",
    "GET /projects/:id/database",
    "GET /projects/:id/checkpoints",
    "GET /projects/:id/deployments/:deployId/log",
    "GET /projects/:id/collaborators",
    "GET /projects/:id/github/status",
    "GET /projects/:id/github/branches",
    "GET /projects/:id/env",
    "GET /projects/:id/deployments",
    "GET /snippets",
    "GET /snippets/:id",
    "GET /projects/:id/env/validate",
    "GET /projects/:id/preview-proxy",
    "GET /projects/:id/file-binary",
    "GET /projects/:id/sdk",
    "GET /projects/:id/export",
    "GET /projects/:id/domain/status",
    "GET /studio/spend",
    "GET /studio/credits",
  ],
  "qcoreai.ts": [
    "GET /me/webhook",
    "GET /me/webhook/log",
    "GET /me/webhook/stats",
    "GET /notebook/collections",
    "GET /insights",
    "GET /pipelines",
    "GET /pipelines/:id",
    "GET /me/personas",
    "GET /me/analytics-goal",
    "GET /me/spend-limit",
    "GET /me/spend-summary",
    "GET /me/token-quota",
    "GET /sessions",
    "GET /sessions/archived",
    "GET /sessions/:id",
    "GET /runs/:id",
    "GET /analytics",
    "GET /search",
    "GET /tags",
    "GET /presets/:id",
    "GET /analytics/timeseries",
    "GET /analytics/agent-performance",
    "GET /analytics/provider-latency",
    "GET /analytics/by-tag",
    "GET /analytics/sessions",
    "GET /analytics/export",
    "GET /analytics/agent-length",
    "GET /analytics/provider-compare",
    "GET /sessions/:id/export",
    "GET /runs/:id/export",
    "GET /runs/:id/thread",
    "GET /eval/suites",
    "GET /eval/suites/:id",
    "GET /eval/runs/:id",
    "GET /eval/suites/:id/runs",
    "GET /prompts",
    "GET /prompts/audit",
    "GET /prompts/:id",
    "GET /prompts/:id/versions",
    "GET /prompts/:id/diff",
    "GET /templates",
    "GET /templates/:id",
    "GET /batches",
    "GET /batch/:id",
    "GET /schedules",
    "GET /schedules/:id",
    "GET /bookmarks",
    "GET /runs/:id/rating",
    "GET /ratings/top",
    "GET /workspaces",
    "GET /workspaces/:id",
    "GET /workspaces/:id/members",
    "GET /workspaces/:id/sessions",
    "GET /notebook/tags",
    "GET /notebook",
    "GET /notebook/:id",
    "GET /sessions/:id/stats",
    "GET /runs/:id/annotations",
    "GET /me/annotations",
    "GET /sessions/:id/presence",
    "GET /me/usage",
    "GET /me/plan",
    "GET /runs/:id/siblings",
    "GET /orgs",
    "GET /orgs/:id",
    "GET /orgs/:id/members",
    "GET /me/cost-trend",
    "GET /me/api-keys",
    "POST /runs/:id/export-pdf-data",
    "GET /sessions/:id/ai-summary",
    "GET /sessions/:id/timeline",
    "GET /me/rate-limits",
    "GET /prompt-chains",
    "GET /prompt-chains/:id",
    "GET /notebook/collections/:id/summary",
    "POST /notebook/collections/:id/export",
    "GET /me/stats",
    "GET /sessions/:id/invites",
    "GET /me/audit-log",
    "GET /me/memories",
    "GET /ab-tests",
    "GET /ab-tests/:id",
    "GET /me/settings",
    "GET /analytics/cohorts",
    "GET /analytics/top-hours",
    "GET /analytics/run-quality",
    "POST /export/session-bundle",
    "POST /export/full-account",
    "GET /me/routing-rules",
    "GET /sessions/:id/collab/stats",
    "GET /me/collabs",
  ],
};

const ROUTER_DEF = /\b\w+Router\.(get|post|put|patch|delete|all)\(\s*["'`]([^"'`]+)/g;

function тела(file: string): Array<{ key: string; body: string }> {
  const src = fs.readFileSync(path.join(__dirname, "..", "src", "routes", file), "utf8");
  const defs: Array<{ key: string; at: number }> = [];
  for (const m of src.matchAll(ROUTER_DEF)) defs.push({ key: `${m[1].toUpperCase()} ${m[2]}`, at: m.index! });
  // Тело ручки — до её закрывающей строки "});" в начале строки (или до следующей ручки):
  // помощники между ручками (resolveAuth и т.п.) в тело не попадают.
  return defs.map((d, i) => {
    const next = i + 1 < defs.length ? defs[i + 1].at : src.length;
    const close = src.indexOf("\n});", d.at);
    const end = close >= 0 && close < next ? close : next;
    return { key: d.key, body: src.slice(d.at, end) };
  });
}

describe("личные ручки зовут verifyBearerLive (119 ручек в 4 файлах + 2 в auth.ts)", () => {
  for (const [file, routes] of Object.entries(ЛИЧНЫЕ)) {
    test(`${file}: ${routes.length} из ${routes.length} ручек на verifyBearerLive, ни одной на голой verifyBearerOptional`, () => {
      const все = тела(file);
      const плохие: string[] = [];
      for (const r of routes) {
        const найдено = все.filter((t) => t.key === r);
        if (найдено.length === 0) { плохие.push(`${r}: маршрут не найден`); continue; }
        for (const t of найдено) {
          if (!t.body.includes("verifyBearerLive(req)")) плохие.push(`${r}: нет verifyBearerLive`);
          if (t.body.includes("verifyBearerOptional(req)")) плохие.push(`${r}: осталась verifyBearerOptional`);
        }
      }
      expect(плохие).toEqual([]);
    });
  }

  test("auth.ts: GET /sessions и GET /me/audit — через requireAuthLive (2 из 2)", () => {
    const все = тела("auth.ts");
    for (const r of ["GET /sessions", "GET /me/audit"]) {
      const t = все.find((x) => x.key === r);
      expect(t, r).toBeTruthy();
      expect(t!.body).toContain("await requireAuthLive(req, res)");
    }
  });

  test("КОНТРОЛЬ прибора: публичная ручка без перевода находится и видна как verifyBearerOptional", () => {
    const t = тела("qright.ts").find((x) => x.key === "POST /objects");
    expect(t).toBeTruthy();
    expect(t!.body).toContain("verifyBearerOptional(req)");
  });
});
