import { describe, test, expect, beforeEach, vi } from "vitest";

/**
 * Сторож: недельная рассылка не уходит на НАШИ пробные адреса.
 *
 * 🔴 Замер 29.09.2026. В списке подписки лежали два адреса, заведённых нашими же
 * прогонами: `smoke-c2-2026-09-29@aevion.app` и
 * `smoke-qventure-2026-09-29@aevion.app` — ими доказывали, что сбор почты
 * доходит до базы. Дайджест выбирает ВЕСЬ список, значит письма ушли бы и им.
 *
 * Вреда наружу нет (адреса на нашем домене), но отчёт «отправлено N» стал бы
 * неверным — а на отчёт смотрят как на замер. Это тот же класс, из-за которого
 * витрины оказались заполнены нашими пробами накануне прошлого запуска.
 *
 * Проверяется ОТПРАВКА (кому реально пошло письмо), а не признак: признак можно
 * оставить верным и забыть применить.
 */

const отправленные: string[] = [];
const { mockQuery } = vi.hoisted(() => ({ mockQuery: vi.fn() }));

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: mockQuery }) }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));
vi.mock("../src/lib/constitutionBrevo", () => ({
  // Подменяем ИМЕННО ту функцию, которую зовёт дайджест: первая попытка
  // подменила несуществующее имя, и тест «прошёл» с нулём отправок — то есть
  // мерил бы не то. Пустой список отправленных обязан читаться как отказ.
  sendWeeklyDigestEmail: async (
    получатели: { email: string }[],
  ) => {
    for (const п of получатели) отправленные.push(п.email);
    return { sent: получатели.length, errors: 0 };
  },
  sendWaitlistConfirm: async () => ({ ok: true }),
}));

const { sendWeeklyDigest } = await import("../src/routes/constitutionWaitlist");

/** Список артефактов и подписчиков: чем отвечает база на два запроса дайджеста. */
function базаОтвечает(адреса: string[]) {
  mockQuery.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes("constitution_waitlist")) {
      return { rows: адреса.map((email) => ({ email })) };
    }
    // Артефакты: без них дайджест пропускается, и тест мерил бы не то.
    return {
      rows: [
        { id: "a1", title: "Проект статьи", author: "Кто-то", score: 9, createdAt: new Date().toISOString() },
      ],
    };
  });
}

beforeEach(() => {
  отправленные.length = 0;
  mockQuery.mockReset();
});

describe("недельная рассылка", () => {
  test("пробные адреса пропускаются, живые получают письмо", async () => {
    базаОтвечает([
      "smoke-c2-2026-09-29@aevion.app",
      "reader@example.org",
      "smoke-qventure-2026-09-29@aevion.app",
    ]);

    await sendWeeklyDigest();

    expect(
      отправленные.filter((a) => a.startsWith("smoke-")),
      `письмо ушло на нашу пробу: ${отправленные.join(", ")}`,
    ).toEqual([]);
    expect(отправленные, "живой подписчик не получил письмо — фильтр слишком широкий").toContain(
      "reader@example.org",
    );
  });

  test("КОНТРОЛЬ: адрес, лишь ПОХОЖИЙ на пробу словом, письмо получает", async () => {
    // `test@…` без разделителя после слова — живой человек, а не прогон.
    базаОтвечает(["test@company.com", "testimonial@x.ru"]);

    await sendWeeklyDigest();

    expect(отправленные.sort(), "защита от проб превратилась в потерю подписчиков").toEqual(
      ["test@company.com", "testimonial@x.ru"].sort(),
    );
  });
});
