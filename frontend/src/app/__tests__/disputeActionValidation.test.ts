import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { POST } from "../api/payments/v1/disputes/[id]/route";
import { kvList, kvSet } from "../api/payments/v1/_persist";

/**
 * Разбор действия по спору был тернарным каскадом с «иначе lost»:
 *
 *   action === "respond" ? "under_review" : action === "resolve_won" ? "won" : "lost"
 *
 * То есть ЛЮБОЕ неизвестное значение — опечатка `resolve_wonn`, старая версия
 * SDK, чужой клиент — молча помечало спор ПРОИГРАННЫМ, худшим для продавца
 * исходом. Рядом стояло сообщение об ошибке, перечисляющее три действия, и это
 * читалось как «значение проверяется». Не проверялось.
 *
 * Тест ходит через настоящий обработчик маршрута, а не через выделенную
 * функцию: проверяется вызывающий код, а не только разбор.
 */

const KEY = "disputes.v1";
const AUTH = { Authorization: "Bearer sk_test_abcdefgh1234" };

function seedDispute(id: string) {
  const now = Date.now();
  return kvSet(KEY, [
    {
      id,
      link_id: "pl_seed",
      amount: 4900,
      currency: "USD",
      reason: "product_not_received",
      status: "warning_needs_response",
      evidence_url: null,
      evidence_text: null,
      due_by: now + 86_400_000,
      created: now,
      updated: now,
    },
  ]);
}

function actionReq(id: string, body: unknown): NextRequest {
  return new Request(`https://aevion.app/api/payments/v1/disputes/${id}`, {
    method: "POST",
    headers: { ...AUTH, "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function statusOf(id: string): Promise<string | undefined> {
  const all = await kvList<{ id: string; status: string }>(KEY);
  return all.find((d) => d.id === id)?.status;
}

describe("действие по спору: опечатка не должна означать «проиграл»", () => {
  it("неизвестное действие отбивается, спор остаётся нетронутым", async () => {
    await seedDispute("dp_typo");
    const res = await POST(actionReq("dp_typo", { action: "resolve_wonn" }), ctx("dp_typo"));

    expect(res.status).toBe(400);
    expect(await statusOf("dp_typo")).toBe("warning_needs_response");
  });

  it("«resolve_won» по-прежнему выигрывает спор", async () => {
    await seedDispute("dp_win");
    const res = await POST(actionReq("dp_win", { action: "resolve_won" }), ctx("dp_win"));

    expect(res.status).toBe(200);
    expect(await statusOf("dp_win")).toBe("won");
  });

  it("«resolve_lost» по-прежнему проигрывает — намеренно, а не по умолчанию", async () => {
    await seedDispute("dp_lose");
    const res = await POST(actionReq("dp_lose", { action: "resolve_lost" }), ctx("dp_lose"));

    expect(res.status).toBe(200);
    expect(await statusOf("dp_lose")).toBe("lost");
  });

  it("«respond» переводит в разбор", async () => {
    await seedDispute("dp_resp");
    const res = await POST(actionReq("dp_resp", { action: "respond" }), ctx("dp_resp"));

    expect(res.status).toBe(200);
    expect(await statusOf("dp_resp")).toBe("under_review");
  });

  it("прототипный ключ не проходит как действие", async () => {
    await seedDispute("dp_proto");
    const res = await POST(actionReq("dp_proto", { action: "constructor" }), ctx("dp_proto"));

    expect(res.status).toBe(400);
    expect(await statusOf("dp_proto")).toBe("warning_needs_response");
  });

  /**
   * Та же связка «прочитал → проверил → записал», что была в возвратах. Без
   * замка два одновременных запроса читают ОДИН И ТОТ ЖЕ статус, оба проходят
   * проверку допустимых переходов, побеждает записавший последним — а в журнал
   * попадают ОБА исхода, и спор числится и выигранным, и проигранным.
   */
  it("два одновременных решения по спору дают ровно один исход", async () => {
    await seedDispute("dp_race");

    const [a, b] = await Promise.all([
      POST(actionReq("dp_race", { action: "resolve_won" }), ctx("dp_race")),
      POST(actionReq("dp_race", { action: "resolve_lost" }), ctx("dp_race")),
    ]);

    const codes = [a.status, b.status].sort((x, y) => x - y);
    expect(codes[0]).toBe(200); // один решил
    expect([409]).toContain(codes[1]); // второй отбит: переход уже сделан

    const status = await statusOf("dp_race");
    expect(["won", "lost"]).toContain(status); // исход ОДИН, а не последний из двух
  });
});
