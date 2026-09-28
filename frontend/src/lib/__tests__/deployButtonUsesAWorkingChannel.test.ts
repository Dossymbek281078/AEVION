// 🔴 Кнопка «Выкатить» не отправляла НИ ОДНОГО запроса. Замер соседнего окна живым
// браузером, гостем, три прогона: «Построить» — 9 запросов, «Выкатить» — 0, состояние
// «черновик», адреса нет. Причина не в сети: обработчик спрашивал возможность railway
// (на проде not_available) и выходил ДО вызова, при рабочем Cloudflare Pages рядом.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { indexCapabilities, каналВыкатки } from "../devhubCapabilities";

const страница = readFileSync(
  join(__dirname, "..", "..", "app", "devhub", "[id]", "page.tsx"),
  "utf8",
);

const состояние = (пары: Array<[string, string]>) =>
  indexCapabilities(пары.map(([id, status]) => ({ id, status })) as never);

describe("канал публикации выбирается по тому, что работает", () => {
  it("прод сегодня: railway мёртв, pages жив — публикуем через pages", () => {
    expect(каналВыкатки(состояние([["railway", "not_available"], ["pages", "live"]]))).toBe("pages");
  });

  it("если однажды оживёт railway, а pages отвалится — публикуем через railway", () => {
    expect(каналВыкатки(состояние([["railway", "live"], ["pages", "needs_token"]]))).toBe("railway");
  });

  it("оба мертвы — канала нет, и кнопка обязана это сказать, а не молчать", () => {
    expect(каналВыкатки(состояние([["railway", "not_available"], ["pages", "not_available"]]))).toBeNull();
  });

  it("панель не загрузилась — не блокируем: незнание не мёртвая кнопка", () => {
    expect(каналВыкатки(null)).toBe("pages");
    expect(каналВыкатки(состояние([]))).toBe("pages");
  });

  it("кнопка зовёт выбор канала, а не railway напрямую", () => {
    const i = страница.indexOf("const deploy = async ()");
    expect(i).toBeGreaterThan(0);
    const тело = страница.slice(i, i + 700);
    expect(тело).toContain("каналВыкатки(caps)");
    expect(тело).toContain("deployToPages()");
    // и прежний путь сохранён под своим именем, а не удалён
    expect(страница).toContain("deployViaRailway");
  });
});
