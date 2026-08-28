import { describe, test, expect, vi } from "vitest";

/**
 * Ссылка совместного просмотра НЕ является приглашением в сессию.
 *
 * 28.08.2026 ссылки просмотра переехали из памяти в таблицу
 * "QCoreSessionInvite" — она подошла по полям и уже существовала. Но читатель
 * приглашений выбирал строку ТОЛЬКО по токену, без фильтра по роли: значит
 * токен просмотра начал бы резолвиться и как приглашение.
 *
 * Это два разных права с разным сроком жизни за одним ключом. Сегодня ручка
 * /invites/:token отдаёт лишь {sessionId, role} и сама ничего не выдаёт — но
 * ровно так и выглядит мина: пока никто не действует по этому ответу, всё
 * тихо; первый, кто начнёт, получит выдачу доступа по ссылке «только
 * посмотреть».
 *
 * Стенд исполняет присланный запрос, а не решает сам: иначе он остался бы
 * зелёным и после снятия фильтра.
 */

const rows = [
  { id: "i1", token: "invite-token", sessionId: "s1", invitedBy: "owner", role: "viewer", expiresAt: null },
  { id: "c1", token: "collab-token", sessionId: "s1", invitedBy: "owner", role: "collab", expiresAt: null },
];

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    connect: async () => ({ query: async () => ({ rows: [], rowCount: 0 }), release: () => {} }),
    query: async (sql?: string, params?: unknown[]) => {
      const s = String(sql ?? "");
      if (!s.includes("QCoreSessionInvite")) return { rows: [], rowCount: 0 };
      const head = s.trimStart().toUpperCase();

      if (head.startsWith("DELETE")) {
        const excludes = s.includes(`"role" <> 'collab'`);
        const i = rows.findIndex(
          (r) =>
            r.id === String(params?.[0] ?? "") &&
            r.invitedBy === String(params?.[1] ?? "") &&
            (!excludes || r.role !== "collab"),
        );
        if (i < 0) return { rows: [], rowCount: 0 };
        rows.splice(i, 1);
        return { rows: [], rowCount: 1 };
      }

      if (!head.startsWith("SELECT")) return { rows: [], rowCount: 0 };
      // Фильтр по роли применяем ТОЛЬКО если он есть в запросе: стенд,
      // отсеивающий collab всегда, остался бы зелёным и после снятия фильтра.
      const excludesCollab = s.includes(`"role" <> 'collab'`);
      const bySession = s.includes(`"sessionId"=$1`);
      const out = rows.filter((r) =>
        (bySession
          ? r.sessionId === String(params?.[0] ?? "") && r.invitedBy === String(params?.[1] ?? "")
          : r.token === String(params?.[0] ?? "")) &&
        (!excludesCollab || r.role !== "collab"));
      return { rows: out, rowCount: out.length };
    },
  }),
}));
vi.mock("../src/lib/ensureQCoreTables", () => ({
  ensureQCoreTables: async () => {},
  isDbReady: () => true,
  getDbError: () => null,
}));

import {
  getSessionInvite,
  listSessionInvites,
  deleteSessionInvite,
} from "../src/services/qcoreai/store";

describe("токен совместного просмотра не проходит как приглашение", () => {
  test("обычное приглашение по-прежнему находится", async () => {
    // Контроль: без него «ничего не находится» выглядело бы как успех правила.
    const r = await getSessionInvite("invite-token");
    expect(r, "сломан сам механизм приглашений").toBeTruthy();
    expect(r?.role).toBe("viewer");
  });

  test("список приглашений владельца не показывает ссылки просмотра", async () => {
    // Частичное разделение хуже полного: список, иногда показывающий чужой
    // механизм, однажды дадут на экран — и там появятся «приглашения»,
    // которых владелец не создавал.
    const list = await listSessionInvites("s1", "owner");
    expect(list.map((x) => x.role)).toEqual(["viewer"]);
  });

  test("ссылку просмотра нельзя удалить через API приглашений", async () => {
    // Третье и последнее место, где механизмы делят таблицу. Путь сегодня
    // недостижим — id ссылки через список приглашений не получить. Ровно так
    // я рассуждал и про читателя по токену, где дыра оказалась настоящей:
    // правило должно быть одинаковым во всех трёх местах.
    expect(await deleteSessionInvite("c1", "owner"), "чужой механизм удалён через API приглашений").toBe(false);
    expect(await deleteSessionInvite("i1", "owner"), "сломано удаление настоящего приглашения").toBe(true);
  });

  test("токен просмотра приглашением НЕ считается", async () => {
    const r = await getSessionInvite("collab-token");
    expect(
      r,
      "ссылка «только посмотреть» резолвится как приглашение в сессию: два " +
        "разных права за одним ключом",
    ).toBeNull();
  });
});
