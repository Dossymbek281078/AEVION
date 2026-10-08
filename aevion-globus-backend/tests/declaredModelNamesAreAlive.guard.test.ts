import { describe, test, expect, beforeEach, afterEach } from "vitest";

/**
 * Панель состояния обязана заметить, что ИМЯ модели у поставщика исчезло.
 *
 * Повод 07.10.2026: проверки отвечали «ключ годен, деньги есть» — правда, при
 * которой модуль всё равно падал. Из трёх объявленных моделей Gemini жива
 * была одна, из семи слагов OpenRouter — две, и `healthai` с явным
 * `provider: "gemini"` не работал вовсе.
 *
 * Сеть подменена: проверяется НАША логика сравнения и то, какой ответ увидит
 * человек. Живость самих моделей — отдельный инструмент с ключами.
 */

process.env.GEMINI_API_KEY = "test-gemini";
process.env.ANTHROPIC_API_KEY = "test-anthropic";
process.env.OPENAI_API_KEY = "test-openai";
process.env.OPENROUTER_API_KEY = "test-openrouter";

const { проверитьИменаМоделей, сброситьКэшИмёнМоделей } = await import("../src/lib/объявленныеМодели");
const { getProviders } = await import("../src/services/qcoreai/providers");

/** Что РЕАЛЬНО объявлено в реестре — тест не повторяет список своими словами. */
function объявленные(id: string): string[] {
  return getProviders().find((p) => p.id === id)?.models ?? [];
}

function сетьОтвечает(поставщикиИхМодели: Record<string, string[] | "ошибка">) {
  global.fetch = (async (url: string) => {
    const u = String(url);
    const кто = u.includes("generativelanguage")
      ? "gemini"
      : u.includes("api.openai.com")
        ? "openai"
        : u.includes("api.anthropic.com")
          ? "anthropic"
          : "openrouter";
    const знач = поставщикиИхМодели[кто];
    if (!знач || знач === "ошибка") {
      return { ok: false, status: 500, json: async () => ({}), text: async () => "{}" };
    }
    const тело =
      кто === "gemini"
        ? { models: знач.map((n) => ({ name: "models/" + n })) }
        : { data: знач.map((id) => ({ id })) };
    return { ok: true, status: 200, json: async () => тело, text: async () => JSON.stringify(тело) };
  }) as unknown as typeof fetch;
}

/** Все четверо отвечают ровно тем, что мы объявили. */
function всёНаМесте(): Record<string, string[]> {
  return {
    gemini: объявленные("gemini"),
    openai: объявленные("openai"),
    anthropic: объявленные("anthropic"),
    openrouter: объявленные("openrouter"),
  };
}

describe("панель замечает пропавшее имя модели", () => {
  // Кэш живёт 6 часов, поэтому между проверками его сбрасывают с обеих
  // сторон: иначе вторая проверка судила бы ответ, посчитанный в первой.
  beforeEach(() => сброситьКэшИмёнМоделей());
  afterEach(() => сброситьКэшИмёнМоделей());

  test("контроль: всё на месте → ok и названо число проверенных имён", async () => {
    сетьОтвечает(всёНаМесте());
    const r = await проверитьИменаМоделей();
    expect(r.ok, "исправное состояние названо поломкой: " + r.detail).toBe(true);
    expect(r.detail).toMatch(/проверено имён: [1-9]/);
    expect(r.detail, "граница силы ответа не названа").toMatch(/слабее/);
  });

  test("🔴 модель исчезла у поставщика → НЕ ok и имя названо", async () => {
    const все = всёНаМесте();
    const пропавшая = все.gemini[0];
    все.gemini = все.gemini.slice(1);
    сетьОтвечает(все);
    const r = await проверитьИменаМоделей();
    expect(r.ok, "пропажа имени прошла как «всё хорошо»").toBe(false);
    expect(r.detail).toContain("gemini/" + пропавшая);
  });

  test("🔴 поставщик не ответил → НЕ ok, и это сказано отдельно от пропажи", async () => {
    // «Не смог спросить» и «нашёл пропажу» — разные беды, и лечатся по-разному.
    const все: Record<string, string[] | "ошибка"> = { ...всёНаМесте(), anthropic: "ошибка" };
    сетьОтвечает(все);
    const r = await проверитьИменаМоделей();
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/не спрошены:.*anthropic/);
    expect(r.detail, "ложно объявлено пропавшим то, о чём не спросили").not.toContain("anthropic/");
  });

  test("ответ кэшируется — заход на панель не ходит в сеть каждый раз", async () => {
    let обращений = 0;
    сетьОтвечает(всёНаМесте());
    const настоящий = global.fetch;
    global.fetch = (async (...a: unknown[]) => {
      обращений += 1;
      return (настоящий as (...x: unknown[]) => Promise<unknown>)(...a);
    }) as unknown as typeof fetch;
    await проверитьИменаМоделей();
    const послеПервого = обращений;
    await проверитьИменаМоделей();
    expect(обращений, "второй заход снова пошёл в сеть").toBe(послеПервого);
    expect(послеПервого, "в сеть не ходили вовсе — проверять нечего").toBeGreaterThan(0);
  });
});

/**
 * Вторая половина, без которой первая проверяет ЗАМЫСЕЛ.
 *
 * Правило §0-СТОРОЖ-ДЕЛАЕТ-ЗАПРОС: проверка на ручку обязана дёрнуть ручку и
 * прочитать ТЕЛО ответа. Выше проверена функция; если её забудут позвать из
 * `/api/devhub/providers/health`, выше всё останется зелёным, а панель снова
 * будет говорить «ключ годен» о модуле, который не работает.
 */
describe("ручка состояния действительно задаёт этот вопрос", () => {
  beforeEach(() => сброситьКэшИмёнМоделей());
  afterEach(() => сброситьКэшИмёнМоделей());

  test("🔴 в ответе /providers/health есть проба models_declared", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { devhubRouter } = await import("../src/routes/devhub");

    const все = всёНаМесте();
    const пропавшая = все.gemini[0];
    все.gemini = все.gemini.slice(1);
    сетьОтвечает(все);

    const a = express();
    a.use("/api/devhub", devhubRouter);
    const r = await request(a).get("/api/devhub/providers/health");

    expect(r.status, `ручка ответила ${r.status}`).toBe(200);
    const проба = (r.body.checks || []).find(
      (c: { name: string }) => c.name === "models_declared",
    );
    expect(проба, "пробы models_declared в ответе нет — панель этот вопрос не задаёт").toBeTruthy();
    expect(проба.ok, "пропавшее имя модели прошло через панель как «всё хорошо»").toBe(false);
    expect(String(проба.detail)).toContain("gemini/" + пропавшая);
  });
});

/**
 * Третья проба и ТРЕТИЙ вопрос: отвечает ли умолчание на настоящий вызов.
 *
 * Держать это вместе с проверкой имён нельзя — разница измерена 07.10.2026:
 * `gemini-2.0-flash-001` ИСЧЕЗ из каталога (ловит проверка имён), а
 * `gemini-2.5-pro` в каталоге ЕСТЬ и отвечает 404 (ловит только вызов).
 */
describe("умолчание поставщика отвечает на настоящий вызов", () => {
  beforeEach(async () => {
    const m = await import("../src/lib/объявленныеМодели");
    m.сброситьКэшВызоваУмолчаний();
  });

  function сетьОтвечаетНаВызов(отказать: string[], код = 404) {
    global.fetch = (async (url: string, init?: RequestInit) => {
      const тело = String(init?.body ?? "");
      const плохая = отказать.some((м) => String(url).includes(м) || тело.includes(`"${м}"`));
      return плохая
        ? { ok: false, status: код, json: async () => ({}), text: async () => "{}" }
        : { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
    }) as unknown as typeof fetch;
  }

  test("контроль: все умолчания отвечают → ok и названо число", async () => {
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    сетьОтвечаетНаВызов([]);
    const r = await проверитьУмолчанияВызовом();
    expect(r.ok, "исправное состояние названо поломкой: " + r.detail).toBe(true);
    expect(r.detail).toMatch(/проверено имён вызовом: [1-9]/);
  });

  test("🔴 спрашивать некого → НЕ ok: «не знаю» не равно «всё хорошо»", async () => {
    // Без этой проверки правило выродилось бы в «отказавших нет — значит
    // хорошо», и проба, переставшая кого-либо звать, отвечала бы зелёным.
    // Мутация «убрать `спрошено > 0`» ПРОХОДИЛА, пока этого теста не было.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const было = {
      g: process.env.GEMINI_API_KEY,
      a: process.env.ANTHROPIC_API_KEY,
      o: process.env.OPENAI_API_KEY,
      r: process.env.OPENROUTER_API_KEY,
    };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    сетьОтвечаетНаВызов([]);
    try {
      const r = await проверитьУмолчанияВызовом();
      expect(r.ok, "ни одного поставщика не спросили, а ответ зелёный").toBe(false);
      expect(r.detail).toContain("проверено имён вызовом: 0");
    } finally {
      if (было.g) process.env.GEMINI_API_KEY = было.g;
      if (было.a) process.env.ANTHROPIC_API_KEY = было.a;
      if (было.o) process.env.OPENAI_API_KEY = было.o;
      if (было.r) process.env.OPENROUTER_API_KEY = было.r;
    }
  });

  test("🔴 умолчание отвечает 404 → НЕ ok, имя и причина названы", async () => {
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const умолчание = getProviders().find((p) => p.id === "anthropic")!.defaultModel;
    сетьОтвечаетНаВызов([умолчание]);
    const r = await проверитьУмолчанияВызовом();
    expect(r.ok, "мёртвое умолчание прошло как «всё хорошо»").toBe(false);
    expect(r.detail).toContain(умолчание);
    expect(r.detail).toContain("404");
  });
  test("🔴 последнее звено запаса (OpenRouter) тоже зовётся вызовом", async () => {
    // До 07.10 его модели были проверены ТОЛЬКО каталогом, а он — последнее
    // звено цепочки: gemini (срок 12.10) → openai (денег нет) → anthropic
    // ($8.93) → openrouter. Проверять каталогом то, на чём всё держится,
    // значит не проверять: `gemini-2.5-pro` в каталоге был и отвечал 404.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const умолчание = getProviders().find((p) => p.id === "openrouter")!.defaultModel;
    сетьОтвечаетНаВызов([умолчание]);
    const r = await проверитьУмолчанияВызовом();
    expect(r.ok, "мёртвое умолчание OpenRouter прошло как «всё хорошо»").toBe(false);
    expect(r.detail, "OpenRouter не зовётся вызовом — последнее звено не проверено").toContain(умолчание);
  });

  test("🔴 у Gemini и OpenRouter зовётся ВЕСЬ список, а не одно умолчание", async () => {
    // Повод 08.10.2026: сильная проверка по всему списку была ручной, и ключ
    // для неё брался через буфер обмена — общий ресурс. Буфер подсунул чужой
    // телефон, и прибор объявил три ЖИВЫЕ модели мёртвыми. Пока шаг ручной,
    // этот источник ошибки возвращается на каждой волне.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const п = getProviders();
    const ожидается =
      (п.find((x) => x.id === "gemini")?.models.length ?? 0) +
      (п.find((x) => x.id === "openrouter")?.models.length ?? 0) +
      2; // anthropic и openai — по одному умолчанию, их список не зовём (деньги)
    сетьОтвечаетНаВызов([]);
    const r = await проверитьУмолчанияВызовом();
    expect(r.detail, "знаменатель не напечатан").toMatch(/проверено имён вызовом: \d+/);
    const вызвано = Number(/проверено имён вызовом: (\d+)/.exec(r.detail)?.[1] ?? 0);
    expect(
      вызвано,
      `вызвано ${вызвано}, а объявлено к вызову ${ожидается} — кто-то из поставщиков проверяется умолчанием вместо списка`,
    ).toBe(ожидается);
  });

  test("🔴 несуществующее имя в списке Gemini краснит пробу", async () => {
    // Мутация оркестратора: объявить модель, которой нет. Без этого случая
    // расширение списка было бы украшением — число растёт, находки нет.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const последняя = getProviders().find((x) => x.id === "gemini")!.models.at(-1)!;
    сетьОтвечаетНаВызов([последняя]);
    const r = await проверитьУмолчанияВызовом();
    expect(r.ok, "мёртвое имя в списке прошло как «всё хорошо»").toBe(false);
    expect(r.detail).toContain("gemini/" + последняя);
  });

  test("контроль: у БЕСПЛАТНОЙ модели 429 — это «занято», а не поломка", async () => {
    // Иначе проверка краснела бы при исправной системе: отказ по частоте у
    // бесплатных слагов — обычное состояние, а не находка. У платной тот же
    // 429 означает «кончились деньги» и находкой остаётся.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const слаг = getProviders().find((x) => x.id === "openrouter")!.defaultModel;
    сетьОтвечаетНаВызов([слаг], 429);
    const r = await проверитьУмолчанияВызовом();
    expect(r.detail, "занятость бесплатной модели не названа").toContain("занято по частоте");
    expect(r.ok, "занятая бесплатная модель покрасила пробу — это ложная тревога").toBe(true);
  });

  test("🔴 у ПЛАТНОЙ модели 429 — это находка, а не «занято»", async () => {
    // Живой случай на проде: openai отвечает 429 на любое имя, потому что
    // кончились деньги. Если мерить занятость без различия «бесплатный /
    // платный», этот отказ уедет в «занято» и исчезнет из находок — то есть
    // мы перестанем видеть, что звено цепочки не работает.
    // Мутация «снять условие п.free» ПРОХОДИЛА, пока этого случая не было.
    const { проверитьУмолчанияВызовом } = await import("../src/lib/объявленныеМодели");
    const { getProviders } = await import("../src/services/qcoreai/providers");
    const платная = getProviders().find((x) => x.id === "openai")!;
    expect(платная.free, "предпосылка теста неверна: openai считается бесплатным").toBe(false);
    сетьОтвечаетНаВызов([платная.defaultModel], 429);
    const r = await проверитьУмолчанияВызовом();
    expect(r.ok, "отказ платного по деньгам прошёл как «всё хорошо»").toBe(false);
    expect(r.detail).toContain("openai/" + платная.defaultModel);
    expect(r.detail, "отказ по деньгам записан в «занято»").not.toMatch(
      new RegExp("занято по частоте[^·]*openai"),
    );
  });

  test("🔴 ручка состояния действительно задаёт и ЭТОТ вопрос", async () => {
    // Мутация «убрать пробу из ручки» ПРОХОДИЛА, пока проверка смотрела
    // только на функцию: забытый вызов оставил бы её зелёной, а панель слепой.
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { devhubRouter } = await import("../src/routes/devhub");
    const { getProviders } = await import("../src/services/qcoreai/providers");

    const умолчание = getProviders().find((p) => p.id === "anthropic")!.defaultModel;
    сетьОтвечаетНаВызов([умолчание]);

    const a = express();
    a.use("/api/devhub", devhubRouter);
    const r = await request(a).get("/api/devhub/providers/health");

    expect(r.status, `ручка ответила ${r.status}`).toBe(200);
    const проба = (r.body.checks || []).find(
      (c: { name: string }) => c.name === "default_model_answers",
    );
    expect(проба, "пробы default_model_answers в ответе нет — панель этот вопрос не задаёт").toBeTruthy();
    expect(проба.ok, "мёртвое умолчание прошло через панель как «всё хорошо»").toBe(false);
    expect(String(проба.detail)).toContain(умолчание);
  });
});
