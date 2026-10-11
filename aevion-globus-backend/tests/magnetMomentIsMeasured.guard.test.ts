import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 В КАКОЙ МОМЕНТ МЫ ПРОСИМ АДРЕС — ЭТО ТЕПЕРЬ ЧИСЛО, А НЕ ДОГАДКА.
 *
 * Повод — состав живого пути, снятый окном 37 на проде 12.10.2026:
 * у события `waitlist_offer_shown` приходит `surface=first-move` и
 * `отПопытки=true`, потому что на пути задачи «первый ход» — это НЕВЕРНАЯ
 * попытка. То есть форму с адресом мы показываем человеку в тот момент, когда
 * он только что ошибся.
 *
 * За 11.10 было «показали 1 живому, оставил 0». Если показы в основном такие,
 * то причина не в тексте формы и не в её достижимости (её чинило окно 16), а в
 * МОМЕНТЕ — и правка продукта совсем другая: показывать после УСПЕХА.
 *
 * ⚠️ Ступень `offerShown` при этом НЕ уменьшается, и это проверяется отдельно.
 * Форму показали — это правда независимо от того, каким был предыдущий полуход.
 * Признак описывает ХОД, а не показ; вычитать здесь значило бы сделать число
 * МЕНЬШЕ правды, то есть повторить ошибку с `progressed` в обратную сторону.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-magnet-moment-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const сейчас = () => new Date().toISOString();

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
}

beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);

beforeEach(() => {
  журнал([]);
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

function вход(sid: string, наш = false) {
  return {
    type: "page_view",
    ts: сейчас(),
    sid,
    path: наш ? "/cyberchess?c=yt&probe=okno" : "/cyberchess?c=yt",
    meta: { channel: "youtube", post: "komm-mat3" },
  };
}

/** Показ формы ровно в том виде, в каком его шлёт страница. */
function показ(sid: string, отПопытки: boolean) {
  return {
    type: "waitlist_offer_shown",
    ts: сейчас(),
    sid,
    path: "/cyberchess",
    meta: {
      channel: "youtube",
      post: "komm-mat3",
      surface: "first-move",
      plies: 1,
      moves: отПопытки ? 0 : 0,
      attempts: отПопытки ? 1 : 0,
      отПопытки,
    },
  };
}

async function разрез() {
  const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
  expect(r.status).toBe(200);
  return { тело: r.body, пост: r.body.byPost["youtube/komm-mat3"], канал: r.body.byChannel.youtube };
}

describe("момент показа магнита измеряется", () => {
  it("🔴 показ после неверной попытки назван отдельным числом", async () => {
    журнал([вход("ошибся"), показ("ошибся", true)]);
    const { пост, канал, тело } = await разрез();
    expect(пост.offerShownAfterAttempt, "момент показа не измеряется").toBe(1);
    expect(канал.offerShownAfterAttempt).toBe(1);
    expect(тело.totalBySession.offerShownAfterAttempt).toBe(1);
  });

  it("🔴 ступень «показали» при этом НЕ уменьшается", async () => {
    /*
     * Контроль против вычета, которого делать нельзя: форму показали, и это
     * правда. Если бы я вычел, число стало бы МЕНЬШЕ правды.
     */
    журнал([вход("ошибся"), показ("ошибся", true)]);
    const { пост } = await разрез();
    expect(пост.offerShown, "показ вычтен — число стало меньше правды").toBe(1);
    expect(пост.offerShownAfterAttempt).toBe(1);
    expect(
      пост.offerShown - пост.offerShownAfterAttempt,
      "показов «после настоящего хода» вышло не столько",
    ).toBe(0);
  });

  it("🔴 показ после НАСТОЯЩЕГО хода в это число не попадает", async () => {
    журнал([вход("сыграл"), показ("сыграл", false)]);
    const { пост } = await разрез();
    expect(пост.offerShown).toBe(1);
    expect(пост.offerShownAfterAttempt, "показ после хода зачтён показом после попытки").toBe(0);
  });

  it("🔴 доля читается: двое после попытки, один после хода", async () => {
    // Ради этого число и заведено: вопрос «не просим ли адрес у того, кто
    // только что ошибся» отвечается долей, а не одним случаем.
    журнал([
      вход("а"),
      показ("а", true),
      вход("б"),
      показ("б", true),
      вход("в"),
      показ("в", false),
    ]);
    const { пост } = await разрез();
    expect(пост.offerShown).toBe(3);
    expect(пост.offerShownAfterAttempt).toBe(2);
  });

  it("наши пробы отделены", async () => {
    журнал([вход("наш", true), показ("наш", true), вход("живой"), показ("живой", true)]);
    const { пост } = await разрез();
    expect(пост.offerShownAfterAttempt).toBe(2);
    expect(пост.offerShownAfterAttemptOurs, "наша проба не отделена").toBe(1);
    expect(пост.offerShownAfterAttempt - пост.offerShownAfterAttemptOurs).toBe(1);
  });

  it("единица — СЕССИЯ: два показа одному человеку это один", async () => {
    журнал([вход("дважды"), показ("дважды", true), показ("дважды", true)]);
    const { пост } = await разрез();
    expect(пост.offerShownAfterAttempt, "показы сложились вместо сессии").toBe(1);
  });

  it("КОНТРОЛЬ: признак читается строго как true", async () => {
    // Строка «true» не признак: иначе чужой клиент одной строкой наполнил бы
    // число, которым решают, куда переносить магнит.
    журнал([
      вход("строкой"),
      {
        type: "waitlist_offer_shown",
        ts: сейчас(),
        sid: "строкой",
        path: "/cyberchess",
        meta: { channel: "youtube", post: "komm-mat3", отПопытки: "true" },
      },
    ]);
    const { пост } = await разрез();
    expect(пост.offerShown).toBe(1);
    expect(пост.offerShownAfterAttempt, "строка «true» зачтена признаком").toBe(0);
  });

  it("🔴 подпись называет ВОПРОС, на который число отвечает", async () => {
    журнал([вход("ошибся"), показ("ошибся", true)]);
    const { тело } = await разрез();
    expect(String(тело.magnetMomentNote)).toMatch(/НЕВЕРНОЙ/);
    expect(String(тело.magnetMomentNote)).toMatch(/НЕ уменьшается/);
    expect(String(тело.magnetMomentNote), "не сказано, что вопрос про МОМЕНТ").toMatch(/МОМЕНТЕ/);
  });
});
