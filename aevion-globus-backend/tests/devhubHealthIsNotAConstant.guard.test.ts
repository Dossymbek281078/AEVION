import { describe, test, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

/**
 * `status` в /api/devhub/health отражает состояние, а не строку из исходника.
 *
 * Замер 28.08.2026: поле было КОНСТАНТОЙ `"ok"`. Оно не проверяло ничего —
 * при упавшем Postgres соседнее поле `db` честно показывало `"in-memory"`, а
 * `status` продолжал говорить `"ok"`.
 *
 * Дороже всего это стоило смоуку DevHub: он сверяет именно `status === "ok"` и
 * на этом ОСТАНАВЛИВАЕТ прогон. То есть его проверка здоровья не могла
 * покраснеть в принципе, пока процесс отвечает. Проверка, не умеющая
 * краснеть, хуже отсутствующей: на неё ссылаются как на доказательство.
 *
 * Код ответа остаётся 200 намеренно: хаб модулей считает живым всё, что
 * ответило 2xx, и деградация базы не означает недоступность модуля.
 */

const ready = vi.hoisted(() => ({ value: true, error: null as string | null }));

vi.mock("../src/lib/ensureDevHubTables", async (orig) => {
  const actual = await orig<typeof import("../src/lib/ensureDevHubTables")>();
  return {
    ...actual,
    isDevHubDbReady: () => ready.value,
    getDevHubDbError: () => ready.error,
    ensureDevHubTables: async () => undefined,
  };
});

const { devhubRouter } = await import("../src/routes/devhub");

function app() {
  const a = express();
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("health DevHub говорит о состоянии", () => {
  beforeEach(() => { ready.value = true; ready.error = null; });

  test("прибор работает: ручка отвечает и отдаёт нужные поля", async () => {
    const r = await request(app()).get("/api/devhub/health");
    expect(r.status).toBe(200);
    for (const f of ["status", "module", "db", "timestamp"]) expect(r.body).toHaveProperty(f);
  });

  test("база в порядке — статус ok", async () => {
    const r = await request(app()).get("/api/devhub/health");
    expect(r.body.status).toBe("ok");
    expect(r.body.db).toBe("postgres");
    expect(r.body.dbError).toBeNull();
  });

  test("база НЕ в порядке — статус перестаёт быть ok", async () => {
    // Ровно тот случай, который прежняя версия объявляла здоровым.
    ready.value = false;
    ready.error = "connect ECONNREFUSED 10.0.0.5:5432 user=aevion";
    const r = await request(app()).get("/api/devhub/health");
    expect(r.body.status, "статус снова константа").toBe("degraded");
    expect(r.body.db).toBe("in-memory");
    expect(r.body.dbError).toBe(true);
  });

  test("ответ остаётся 200 — деградация это не недоступность", async () => {
    // Хаб модулей считает живым всё, что ответило 2xx. Ронять код ответа
    // значило бы объявить модуль упавшим из-за деградации хранилища.
    ready.value = false;
    const r = await request(app()).get("/api/devhub/health");
    expect(r.status).toBe(200);
  });

  test("причина отдаётся признаком, а не текстом ошибки", async () => {
    // В тексте подключения лежат адрес, порт и пользователь базы.
    ready.value = false;
    ready.error = "connect ECONNREFUSED 10.0.0.5:5432 user=aevion";
    const r = await request(app()).get("/api/devhub/health");
    const body = JSON.stringify(r.body);
    for (const leak of ["10.0.0.5", "5432", "aevion", "ECONNREFUSED"]) {
      expect(body, `наружу ушло «${leak}»`).not.toContain(leak);
    }
  });

  // ОБЛАСТЬ ОХВАТА. Слово `status` шире того, о чём эта ручка знает: она про
  // наше хранилище и ни про что больше. Провайдеры (ключи, зона Cloudflare,
  // платные API) живут в /providers/health, и там 28.08.2026 cloudflare_zone
  // отвечал ok=false — а читатель, увидев "ok", решал, что полный порядок.
  //
  // Переименовать `status` нельзя: его читают снаружи и сверяет смоук.
  // Лечится тем, что рядом сказано, о чём именно ответ.
  test("ответ называет свою область охвата", async () => {
    const r = await request(app()).get("/api/devhub/health");
    expect(r.body.covers, "область охвата не названа").toBe("storage");
    expect(r.body.providersCheckedAt).toBe("/api/devhub/providers/health");
  });
});
