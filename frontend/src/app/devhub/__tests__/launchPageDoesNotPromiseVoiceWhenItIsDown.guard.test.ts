import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { voiceIsKnownDown, capabilityIsKnownOff, COMPARISON_ROWS } from "../capabilityRows";

/**
 * Страница `/devhub/launch` — та, по которой модуль выходит 10.09. Она обещает
 * голос ЧЕТЫРЕЖДЫ: в заголовке шага 3 («Картинки, видео и голос — внутри») и в
 * трёх сценариях шага 2 (озвучка лендинга, аудиочтение статьи, голосовой
 * онбординг панели).
 *
 * Замер прода 08.09.2026: /api/devhub/studio/capabilities отдавал audio_tts как
 * degraded (провайдер озвучки не принял ключ), а страница спрашивала ТОЛЬКО
 * каталог видеомоделей — и писала «работает». Обещание в день запуска, которое
 * продукт не выполнит, дороже любой опечатки.
 */
const LAUNCH = fs.readFileSync(path.resolve(__dirname, "..", "launch", "page.tsx"), "utf8");

describe("страница запуска не обещает то, что сейчас не работает", () => {
  test("нерабочее состояние узнаётся", () => {
    expect(voiceIsKnownDown("degraded"), "degraded — это НЕ работает").toBe(true);
    expect(voiceIsKnownDown("not_available")).toBe(true);
    expect(voiceIsKnownDown("needs_token")).toBe(true);
  });

  test("рабочее состояние молчит", () => {
    expect(voiceIsKnownDown("live"), "живую возможность нельзя объявлять сломанной").toBe(false);
  });

  /**
   * Умолчание ОБРАТНОЕ тому, что у суммы в таблице сравнения, и это осознанно:
   * там незнание не должно занижать нас, здесь — не должно обещать за нас.
   * Но общее у обоих одно: молчание НЕ выдумывает ответ. Ручка не ответила —
   * страница остаётся прежней, а не пугает оговоркой на пустом месте.
   */
  test("незнание не обещает и не пугает: ручка молчит — оговорки нет", () => {
    expect(voiceIsKnownDown(undefined)).toBe(false);
    expect(voiceIsKnownDown(null)).toBe(false);
    expect(voiceIsKnownDown("")).toBe(false);
  });

  test("два предиката отвечают на РАЗНЫЕ вопросы и не подменяют друг друга", () => {
    // Витрина: молчащая ручка не вычитает деньги из нашего же предложения.
    expect(capabilityIsKnownOff([], "audio_tts"), "незнание не должно занижать сумму").toBe(false);
    // Запуск: молчащая ручка не обещает голос за нас — но и не отменяет его.
    expect(voiceIsKnownDown(undefined), "незнание не должно обещать").toBe(false);
    // А вот пришедшее «не работает» обязаны увидеть ОБА.
    expect(
      capabilityIsKnownOff([{ id: "audio_tts", status: "degraded", offCode: "auth_rejected" }], "audio_tts"),
    ).toBe(true);
    expect(voiceIsKnownDown("degraded")).toBe(true);
  });

  test("страница действительно спрашивает состояние возможностей", () => {
    expect(LAUNCH, "страница не спрашивает /studio/capabilities — обещание не на чём проверять").toContain(
      "/api/devhub/studio/capabilities",
    );
    expect(LAUNCH, "состояние озвучки должно браться по имени возможности").toContain('c.id === "audio_tts"');
    expect(LAUNCH, "предикат должен быть общим, а не своей копией").toContain("voiceIsKnownDown(voiceStatus)");
  });

  test("оговорка доходит до ОБОИХ шагов, которые обещают голос", () => {
    const passes = LAUNCH.split("caveat={voiceCaveat}").length - 1;
    expect(passes, "голос обещают два шага — оговорка нужна обоим").toBe(2);
    expect(LAUNCH, "карточка должна уметь показать оговорку").toContain("{caveat}");
  });

  test("оговорка называет, что именно не работает, а не только что «что-то»", () => {
    const i = LAUNCH.indexOf("voiceCaveat =");
    expect(i, "оговорка не найдена").toBeGreaterThan(0);
    const text = LAUNCH.slice(i, i + 400);
    expect(text, "оговорка должна называть голос").toMatch(/[Гг]олос/);
    expect(text, "и говорить, что остальное живо — иначе шаг читается как мёртвый").toMatch(/[Оо]стально/);
  });

  test("таблица сравнения и страница запуска знают одну и ту же возможность", () => {
    const capIds = COMPARISON_ROWS.map((r) => r.cap);
    expect(capIds, "audio_tts пропал из таблицы — страницы разойдутся").toContain("audio_tts");
  });
});
