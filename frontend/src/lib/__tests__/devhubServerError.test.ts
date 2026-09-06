import { describe, test, expect } from "vitest";
import { devhubServerError } from "../devhubServerError";

const FB = "Не удалось выполнить действие";

describe("текст серверной ошибки — на языке человека", () => {
  test("частая группа «X required» становится понятной", () => {
    // Замер 28.08: так отвечают 30+ ручек модуля.
    expect(devhubServerError("prompt required", FB)).toContain("обязательное поле");
    expect(devhubServerError("prompt required", FB)).toContain("prompt");
    expect(devhubServerError("name required", FB)).toContain("name");
  });

  test("длинный текст с уточнением в скобках тоже разбирается", () => {
    const s = devhubServerError("imageUrl (http/https) is required - generate or upload first", FB);
    expect(s).toContain("обязательное поле");
    expect(s).not.toMatch(/required/i);
  });

  test("незнакомое НЕ прячется — иначе человек и мы остаёмся без зацепки", () => {
    const s = devhubServerError("weird upstream hiccup 42", FB);
    expect(s).toContain(FB);
    expect(s, "исходный текст потерян — жалобу будет не по чему найти").toContain("weird upstream hiccup 42");
  });

  test("русский текст сервера не трогаем", () => {
    const ru = "Хранилище недоступно: изменение сохранено только до перезапуска.";
    expect(devhubServerError(ru, FB)).toBe(ru);
  });

  test("нет текста — показывается русский запасной", () => {
    expect(devhubServerError(undefined, FB)).toBe(FB);
    expect(devhubServerError("", FB)).toBe(FB);
    expect(devhubServerError("   ", FB)).toBe(FB);
    expect(devhubServerError(42, FB)).toBe(FB);
  });

  test("настройка канала не выдаётся за поломку", () => {
    const s = devhubServerError("Google Drive not configured — set GOOGLE_DRIVE_KEY", FB);
    expect(s).toContain("не подключён");
    expect(s, "имя переменной окружения на экране у покупателя").not.toContain("GOOGLE_DRIVE_KEY");
  });

  test("предел темпа и деньги названы по-разному", () => {
    expect(devhubServerError("rate limit exceeded", FB)).toContain("Слишком часто");
    expect(devhubServerError("insufficient credits", FB)).toContain("средств");
  });

  test("ни один ответ не пуст и не начинается с латиницы", () => {
    // Контроль формы: перевод, который вернул пустоту, хуже отсутствия перевода.
    for (const raw of ["prompt required", "not found", "unauthorized", "weird", "", "тест"]) {
      const s = devhubServerError(raw, FB);
      expect(s.length).toBeGreaterThan(3);
    }
  });

  test("месячная квота — самое важное сообщение денежного пути", () => {
    // Замер 28.08: сервер отвечает 402 «Monthly deploy limit reached», и до
    // этого правила человек читал его по-английски ровно в тот момент, когда
    // решает, платить ли.
    const s = devhubServerError("Monthly deploy limit reached", FB);
    expect(s).toContain("Месячная норма исчерпана");
    expect(s, "не сказано, ЧТО исчерпалось").toContain("deploy");
    expect(s, "не сказано, когда обновится").toContain("первого числа");
  });

  test("правило работает для всех возможностей, а не только для выкаток", () => {
    // Перечень проверяю на СЛОМАННОМ коде мысленно: если правило привязать к
    // слову deploy, остальные четыре пройдут мимо и останутся английскими.
    for (const cap of ["video", "image", "music", "tts"]) {
      const s = devhubServerError(`Monthly ${cap} limit reached`, FB);
      expect(s, `${cap} не покрыт`).toContain("Месячная норма исчерпана");
      expect(s).toContain(cap);
    }
  });

  // ПОКРЫТИЕ по настоящим ответам сервера.
  //
  // 28.08.2026 я проверял покрытие РАЗБОРОМ: вытащил регулярки грепом и прогнал
  // через eval. Получил три «не покрыто» из четырёх — одно настоящее (месячная
  // квота, починено), два ЛОЖНЫХ: вытаскивающая регулярка не справилась с
  // первым правилом файла, и оно не попало в проверку.
  //
  // Покрытие проверяется ВЫЗОВОМ. Список ниже — настоящие тексты, снятые с
  // прода и из исходника ручек; если функция вернёт исходный текст в скобках,
  // значит правила для него нет.
  test("настоящие ответы сервера покрыты правилами", () => {
    const REAL = [
      "prompt required",
      "name is required",
      "title is required",
      "Monthly deploy limit reached",
      "Monthly video limit reached",
      "Google Drive not configured — set GOOGLE_DRIVE_KEY",
      "project not found",
      "storage_unavailable",
      "rate limit exceeded",
      "insufficient credits",
      "imageUrl (http/https) is required - generate or upload an image first",
    ];
    const uncovered = REAL.filter((r) => devhubServerError(r, FB).includes("(" + r + ")"));
    expect(uncovered, "серверный текст доходит до человека как есть").toEqual([]);
  });

  test("прибор исправен: непокрытое ДЕЙСТВИТЕЛЬНО определяется как непокрытое", () => {
    // Контроль: без него проверка выше зелена и на сломанной функции.
    const nonsense = "zzz quibble frobnicate 12345";
    expect(devhubServerError(nonsense, FB).includes("(" + nonsense + ")")).toBe(true);
  });
});

describe("техническое сообщение не доезжает до покупателя", () => {
  // Тексты взяты ДОСЛОВНО из src/routes/devhub.ts (замер 29.08.2026),
  // а не придуманы: выдуманный вход проверял бы мою фантазию.
  const REAL = [
    "Domain provision not configured - set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in Railway",
    "Voice cloning unavailable - set ELEVENLABS_API_KEY",
    "Database provisioning not configured - set DEVHUB_DB_ADMIN_URL",
    "NO_VISION_PROVIDER: set OPENAI_API_KEY to enable screenshots",
  ];

  it("покупатель не видит ни имён ключей, ни названий панелей", () => {
    expect(REAL.length).toBeGreaterThan(3);
    for (const raw of REAL) {
      const shown = devhubServerError(raw, "Не получилось.");
      expect(shown, raw).not.toMatch(/[A-Z][A-Z0-9]{3,}_[A-Z0-9_]{2,}/);
      expect(shown, raw).not.toContain("Railway");
      // и это по-русски, а не английский огрызок
      expect(shown, raw).toMatch(/[а-яА-ЯёЁ]/);
    }
  });

  it("обычная ошибка по-прежнему показывается целиком", () => {
    // Контроль в обратную сторону: правило не должно проглатывать всё
    // подряд, иначе разбирать отказы станет не по чему.
    const shown = devhubServerError("widget frobnicator stalled", "Не получилось.");
    expect(shown).toContain("widget frobnicator stalled");
  });
});

describe("правила, добавленные по замеру 29.08", () => {
  // Все входы взяты ДОСЛОВНО из src/routes/devhub.ts. Придуманные проверяли
  // бы мою фантазию: я бы сочинил ровно то, что мои же правила и ловят.
  const CASES: Array<[string, string[]]> = [
    ["prompt too long (max 2000 chars)", ["2000", "Описание"]],
    ["text too long (max 128k chars)", ["128k"]],
    ["max 20 steps per workflow", ["20"]],
    ["max 500 files per import", ["500"]],
    ["recipient must be E.164 format (e.g. +14155552671)", ["формате"]],
    ["invalid domain format", ["example.com"]],
    ["project has no files to deploy — add at least index.html", ["index.html"]],
    ["project has no https deployment yet", ["опубликуйте"]],
    ["bad CD entry signature", ["Архив"]],
    ["no voice_id returned for preview", ["результата"]],
    ["Video provider has no credit — top up the Replicate account to generate", ["видео"]],
  ];

  it("каждое сообщение становится русским и сохраняет числа", () => {
    expect(CASES.length, "список входов пуст — проверка ничего не утверждает").toBeGreaterThan(9);
    for (const [raw, must] of CASES) {
      const out = devhubServerError(raw, "Не получилось.");
      // Английский оригинал НЕ должен доехать до человека.
      expect(out, raw).not.toContain(raw);
      expect(out, raw).toMatch(/[а-яА-ЯёЁ]/);
      for (const m of must) expect(out, raw + " -> " + out).toContain(m);
    }
  });

  it("предел без числа не выдумывает число", () => {
    // Обратный контроль: правило с захватом не должно подставлять пустоту
    // или мусор, если числа в сообщении нет.
    const out = devhubServerError("prompt too long", "Не получилось.");
    expect(out).not.toContain("$1");
  });

  it("названия провайдеров не уходят человеку в тексте про видео", () => {
    const out = devhubServerError("Replicate fetch failed", "Не получилось.");
    expect(out).not.toContain("Replicate");
  });
});

describe("язык читателя (06.09.2026)", () => {
  it("для en русская карта НЕ применяется — текст сервера показывается как есть", () => {
    const out = devhubServerError("Monthly video limit reached", "Не получилось.", "en");
    expect(out).toBe("Monthly video limit reached");
    expect(/[а-яё]/i.test(out)).toBe(false);
  });

  it("для en пустой ответ сервера даёт английский запасной текст, а не русский", () => {
    const out = devhubServerError(undefined, "Не получилось.", "en");
    expect(/[а-яё]/i.test(out), "русский запасной текст у EN-читателя").toBe(false);
    expect(out.length).toBeGreaterThan(10);
  });

  it("для en инфраструктурное сообщение прячется по-английски", () => {
    const out = devhubServerError("set CLOUDFLARE_API_TOKEN in Railway", "Не получилось.", "en");
    expect(out).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(/[а-яё]/i.test(out)).toBe(false);
  });

  it("без языка поведение прежнее — русская карта (все старые тесты выше)", () => {
    const out = devhubServerError("Monthly video limit reached", "Не получилось.");
    expect(out).toContain("Месячная норма исчерпана");
  });
});
