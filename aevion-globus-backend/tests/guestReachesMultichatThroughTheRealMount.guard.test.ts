import { describe, test, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Сторож: гость ДОХОДИТ до консилиума через тот же путь, что смонтирован в index.
 *
 * 🔴 ЗАЧЕМ ИМЕННО ПУТЬ, А НЕ МОДУЛЬ ПРОПУСКА. 29.09.2026 бесплатный вход без
 * регистрации не работал на живом проде: страница писала «Бесплатно без входа:
 * осталось 2 запроса», а `POST /api/multichat/conversations` отвечал 401
 * «auth required», счётчик не двигался, ответа агентов не было 70 секунд.
 * Мультичат при этом — первый экран страницы цен, то есть отказ стоял на самом
 * входе воронки.
 *
 * Причин было ДВЕ, и пропуск снимал только первую: он убирал платную стену
 * (`requireModule`), но внутри роутера стоял `requireAuth` на все маршруты, а
 * обработчик берёт владельца из `req.auth!.sub` — гость упал бы и там.
 *
 * Прежний сторож этого не поймал, потому что проверял функции модуля пропуска с
 * ВЫДУМАННЫМИ объектами запроса: `решениеПоГостю` честно отвечал «пускать», и
 * тест был зелёным, пока живой гость получал 401. Поэтому здесь собирается та же
 * цепочка, что в `index.ts`: гостевой пропуск → роутер, и проверяется ОТВЕТ.
 */

const создано: { userId: string; title: string }[] = [];

vi.mock("../src/lib/dbPool", () => ({ getPool: () => null }));
vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => vi.fn() }));

const { multichatRouter } = await import("../src/routes/multichat");
const {
  гостевойСлой,
  решениеПоГостю,
  засчитатьГостю,
  гостевойИдентификатор,
  сброситьСчётГостей,
  гостевойЛимит,
} = await import("../src/lib/multichatGuestPass");

/**
 * Цепочка СОБРАНА ТАК ЖЕ, как в index.ts. Если там её изменят, а здесь нет —
 * сторож разойдётся с боем; поэтому в index.ts рядом с монтированием стоит
 * ссылка на этот файл.
 */
function приложение() {
  const a = express();
  a.use(express.json());
  // 🔴 Цепочка НЕ собирается здесь заново: зовём тот же `гостевойСлой`, что и
  // index.ts. Своя копия правила не ловила мутаций — проверено 30.09.2026, обе
  // мутации боевого кода проходили зелёными, и сторож был бесполезен.
  a.use(
    "/api/multichat",
    гостевойСлой(multichatRouter, (_req, res) => {
      // В бою здесь платная стена; для сторожа достаточно отличить «не пустили»
      // от 401, поэтому отвечаем тем же кодом, что и она.
      res.status(402).json({ error: "upgrade_required" });
    }),
  );
  return a;
}

beforeEach(() => {
  создано.length = 0;
  сброситьСчётГостей();
});

describe("гость и консилиум", () => {
  // ⚠️ Идентификаторы устройств ЛАТИНИЦЕЙ: в значение заголовка HTTP нельзя
  // положить кириллицу — superagent падает «Invalid character in header content».
  // Первая версия теста упала именно на этом, и падение было моим, не кода.
  test("создание консилиума гостем НЕ отбивается 401", async () => {
    const r = await request(приложение())
      .post("/api/multichat/conversations")
      .set("x-aevion-device", "guest-device-1")
      .send({ title: "проверка гостем" });

    expect(
      r.status,
      `гость получил ${r.status} ${JSON.stringify(r.body)} — бесплатный вход снова не работает`,
    ).not.toBe(401);
    expect(r.status, "создание не удалось").toBe(201);
    expect(r.body?.userId, "консилиум не привязан к гостю — ответ агентов уйдёт в чужую переписку")
      .toMatch(/^guest_[0-9a-f]{16}$/);
  });

  test("личность гостя устойчива: второй запрос того же устройства — тот же владелец", async () => {
    const первый = await request(приложение())
      .post("/api/multichat/conversations")
      .set("x-aevion-device", "guest-device-2")
      .send({ title: "раз" });
    const второй = await request(приложение())
      .post("/api/multichat/conversations")
      .set("x-aevion-device", "guest-device-2")
      .send({ title: "два" });

    expect(первый.status).toBe(201);
    expect(второй.status).toBe(201);
    expect(второй.body.userId, "владелец сменился между запросами одного устройства").toBe(
      первый.body.userId,
    );
  });

  test("КОНТРОЛЬ: исчерпав норму, гость получает платную стену, а не 401", async () => {
    // Норму тратит ТОЛЬКО запуск веера (`/dispatch`), а не создание пустого
    // разговора: так написано в правиле, и первая версия этого теста считала
    // иначе — падение было моим, не кода.
    //
    // Здесь роутер подменён заглушкой намеренно: настоящий `/dispatch` зовёт
    // поставщиков ИИ по сети, а вопрос этого случая — не работа агентов, а
    // граница нормы, и она живёт в пропуске и монтировании. Путь через
    // НАСТОЯЩИЙ роутер проверяют случаи выше.
    const a = express();
    a.use(express.json());
    a.use("/api/multichat", (req, res) => {
      const решение = решениеПоГостю(req);
      if (решение.пускать) {
        if (решение.тратить) засчитатьГостю(req);
        res.status(200).json({ ok: true });
        return;
      }
      res.status(402).json({ error: "upgrade_required" });
    });

    for (let i = 0; i < гостевойЛимит(); i += 1) {
      const r = await request(a)
        .post("/api/multichat/conversations/c1/dispatch")
        .set("x-aevion-device", "guest-device-3")
        .send({ prompt: `запуск ${i}` });
      expect(r.status, `запуск ${i} в пределах нормы не прошёл`).toBe(200);
    }
    const сверх = await request(a)
      .post("/api/multichat/conversations/c1/dispatch")
      .set("x-aevion-device", "guest-device-3")
      .send({ prompt: "сверх нормы" });
    expect(сверх.status, "человеку за нормой надо предлагать оплату, а не вход").toBe(402);
  });

  test("КОНТРОЛЬ: путь ВНЕ гостевого списка по-прежнему требует входа", async () => {
    // Список переписок — не бесплатное действие: без этого контроля «пропуск для
    // гостя» незаметно превратился бы в открытый доступ ко всему модулю.
    const r = await request(приложение()).get("/api/multichat/conversations");
    expect(r.status, "чужие переписки открылись гостю").toBe(402);
  });
  test("отказ НЕ съедает бесплатный запуск", async () => {
    // 🔴 Замер 30.09.2026 на живом проде: запрос без поля `agents` получил 400, а
    // норма уменьшилась с 2 до 1. Человек, ошибшийся дважды, терял всё бесплатное
    // обещание, не увидев ни одного ответа агентов. Норма — плата за РАБОТУ.
    const прил = express();
    прил.use(express.json());
    прил.use(
      "/api/multichat",
      гостевойСлой(
        (req, res) => {
          // Повторяем боевой отказ dispatch без агентов: он отвечает 400.
          const тело = (req as unknown as { body?: { agents?: unknown[] } }).body;
          if (!Array.isArray(тело?.agents) || !тело!.agents!.length) {
            res.status(400).json({ error: "agents required" });
            return;
          }
          res.status(200).json({ ok: true });
        },
        (_req, res) => res.status(402).json({ error: "upgrade_required" }),
      ),
    );

    const остаток = () =>
      request(прил)
        .post("/api/multichat/conversations/c1/dispatch")
        .set("x-aevion-device", "guest-device-otkaz")
        .send({ agents: [] })
        .then((r) => r.status);

    expect(await остаток(), "отказ должен быть 400").toBe(400);
    expect(await остаток(), "второй отказ тоже 400").toBe(400);
    expect(await остаток(), "третий отказ — значит норма НЕ съедена отказами").toBe(400);

    // А удачный запуск норму тратит.
    const удачный = await request(прил)
      .post("/api/multichat/conversations/c1/dispatch")
      .set("x-aevion-device", "guest-device-otkaz")
      .send({ agents: [{ id: "a", role: "r" }] });
    expect(удачный.status).toBe(200);
  });

  test("КОНТРОЛЬ: удачные запуски норму всё-таки тратят и она кончается", async () => {
    // Иначе «не списывать за отказы» превратилось бы в «не списывать никогда».
    const прил = express();
    прил.use(express.json());
    прил.use(
      "/api/multichat",
      гостевойСлой(
        (req, res) => {
          // Повторяем боевой отказ dispatch без агентов: он отвечает 400.
          const тело = (req as unknown as { body?: { agents?: unknown[] } }).body;
          if (!Array.isArray(тело?.agents) || !тело!.agents!.length) {
            res.status(400).json({ error: "agents required" });
            return;
          }
          res.status(200).json({ ok: true });
        },
        (_req, res) => res.status(402).json({ error: "upgrade_required" }),
      ),
    );

    for (let i = 0; i < гостевойЛимит(); i += 1) {
      const r = await request(прил)
        .post("/api/multichat/conversations/c1/dispatch")
        .set("x-aevion-device", "guest-device-limit2")
        .send({ agents: [{ id: "a", role: "r" }] });
      expect(r.status, `запуск ${i} в пределах нормы`).toBe(200);
    }
    const сверх = await request(прил)
      .post("/api/multichat/conversations/c1/dispatch")
      .set("x-aevion-device", "guest-device-limit2")
      .send({ agents: [{ id: "a", role: "r" }] });
    expect(сверх.status, "норма не кончилась — списание перестало работать вовсе").toBe(402);
  });
});
