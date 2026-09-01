import { describe, test, expect } from "vitest";
import { WaitlistSubscribeSchema } from "../src/lib/constitutionSchemas";

/**
 * Подписчик приходит с меткой канала, и она хранится отдельно от источника.
 *
 * До 31.08.2026 у подписки было только поле source — «с какой страницы». Про
 * покупки канал знали, про подписчиков нет, хотя список для запуска и есть
 * главный актив воронки: по нему решают, куда вкладывать силы.
 *
 * Здесь проверяется вход. Хранение (первый канал не переписывается повторной
 * подпиской) живёт в SQL и проверяется прогоном с базой.
 */

describe("подписка принимает канал", () => {
  test("обычная метка проходит", () => {
    const r = WaitlistSubscribeSchema.safeParse({
      email: "kto@primer.ru",
      source: "go",
      channel: "telegram",
    });
    expect(r.success).toBe(true);
  });

  test("канал необязателен — старые клиенты продолжают работать", () => {
    expect(WaitlistSubscribeSchema.safeParse({ email: "kto@primer.ru", source: "go" }).success).toBe(true);
  });

  test("чужая строка в канал не проходит", () => {
    // Поле уедет в отчёт и в группировку: пробелы, кириллица и знаки там
    // означают либо чужую ссылку, либо попытку подсунуть своё.
    for (const плохой of ["Telegram", "теле грам", "tg;drop", "a".repeat(25), ""]) {
      const r = WaitlistSubscribeSchema.safeParse({ email: "k@p.ru", channel: плохой });
      expect(r.success, `принят недопустимый канал: ${JSON.stringify(плохой)}`).toBe(false);
    }
  });

  test("канал и источник — разные поля", () => {
    // Дописывать канал в source нельзя: source разбирает рассылка (метки через
    // запятую), и лишнее значение развело бы письма не туда.
    const r = WaitlistSubscribeSchema.safeParse({
      email: "kto@primer.ru",
      source: "cyberchess,constitution",
      channel: "youtube",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("cyberchess,constitution");
      expect(r.data.channel).toBe("youtube");
    }
  });
});
