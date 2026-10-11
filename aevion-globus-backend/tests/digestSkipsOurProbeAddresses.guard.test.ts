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
type Запись = { email: string; source?: string; channel?: string };

/* Запрос, который код ПОСЛАЛ за подписчиками. Нужен отдельной проверкой: мок
   отдаёт строки независимо от текста SQL, поэтому «перестали читать channel»
   сторож иначе пропускает — проверено мутацией 09.10.2026, она прошла насквозь. */
let запросЗаПодписчиками = "";

function базаОтвечает(записи: Array<string | Запись>) {
  запросЗаПодписчиками = "";
  mockQuery.mockImplementation(async (sql: string) => {
    const s = String(sql);
    if (s.includes("constitution_waitlist")) {
      запросЗаПодписчиками = s;
      // Строки можно задать и объектом: с 09.10.2026 признак пробы смотрит ещё и
      // на `channel`, а старая форма (только адрес) оставлена, чтобы прежние
      // случаи читались как раньше.
      return { rows: записи.map((з) => (typeof з === "string" ? { email: з } : з)) };
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

  test("проба, помеченная ТОЛЬКО каналом, письма не получает", async () => {
    /*
     * 🔴 Замер 09.10.2026, повод правки. Исключение проб работало по адресу и
     * `source`. Но наши пробы метятся ПО ПРАВИЛУ каналом: заход делается с
     * `?c=probe-<окно>` (0-НАШИ-ЗАХОДЫ-С-МЕТКОЙ), форма кладёт метку в `channel`,
     * а `source` остаётся обычным именем страницы. То есть проба, сделанная как
     * положено, выглядела живым подписчиком и получила бы письмо — а в этом и
     * состояла необратимость, из-за которой задачу поставили.
     *
     * Проверяется ОТПРАВКА, а не признак: признак можно оставить верным и забыть
     * прочитать поле из базы — ровно это и было (выборка не брала `channel`).
     */
    базаОтвечает([
      { email: "reader2@example.org", source: "/cyberchess", channel: "probe-fd" },
      { email: "live@example.org", source: "/cyberchess", channel: "youtube" },
    ]);

    await sendWeeklyDigest();

    expect(
      отправленные,
      `письмо ушло на пробу, помеченную каналом: ${отправленные.join(", ")}`,
    ).not.toContain("reader2@example.org");
    expect(
      отправленные,
      "живой подписчик с настоящим каналом не получил письмо — фильтр слишком широкий",
    ).toContain("live@example.org");
  });

  test("КОНТРОЛЬ: имя настоящего канала пробой не считается", async () => {
    // Иначе защита от проб выкосила бы весь YouTube и Instagram.
    базаОтвечает([
      { email: "a@example.org", source: "/cyberchess", channel: "youtube" },
      { email: "b@example.org", source: "/go", channel: "instagram" },
      { email: "c@example.org", source: "/devhub", channel: "yt-30-dney" },
    ]);

    await sendWeeklyDigest();

    expect(отправленные.sort(), "живые каналы приняты за пробы").toEqual(
      ["a@example.org", "b@example.org", "c@example.org"].sort(),
    );
  });

  test("запрос за подписчиками берёт ВСЕ три поля признака", async () => {
    /*
     * Признак смотрит на адрес, источник и канал — значит все три обязаны
     * приехать из базы. Это утверждение о ЗАПРОСЕ, а не о файле: мок отдаёт
     * строки независимо от SQL, и без этой проверки мутация «не читать channel»
     * оставляла сторож зелёным, а прод снова рассылал бы на наши пробы.
     */
    базаОтвечает([{ email: "live@example.org", source: "/cyberchess", channel: "youtube" }]);
    await sendWeeklyDigest();
    expect(запросЗаПодписчиками, "код не спрашивал подписчиков вовсе").toContain("constitution_waitlist");
    for (const поле of ['"email"', '"source"', '"channel"']) {
      expect(запросЗаПодписчиками, `в запросе нет поля ${поле} — признак пробы останется слепым`)
        .toContain(поле);
    }
  });
});
