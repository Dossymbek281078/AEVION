import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { checkPublicUrl } from "../src/lib/publicUrlOnly";

/**
 * Вебхуки QCoreAI проверялись только при РЕГИСТРАЦИИ адреса, а сама отправка
 * шла `fetch(target.url)` без единой проверки.
 *
 * Гейт на входе не защищает то, что уже сохранено: адрес мог быть записан до
 * появления проверки, при включённой отдушине для разработки или изменён в
 * обход ручки. Эту же щель я 28.08.2026 закрывал в трёх других модулях —
 * здесь она оставалась последней.
 *
 * Вторая слабость: проверка на входе сверяла СТРОКУ имени. `evil.example.com`,
 * указывающий на 127.0.0.1, проходил бы её насквозь.
 *
 * Здесь проверяется сам предикат, которым закрыта отправка. Показать это через
 * реальную отправку нельзя без управляемого DNS — граница названа честно, как
 * и в стороже общего отправителя.
 */

const saved = { ...process.env };
beforeEach(() => { delete process.env.QCORE_ALLOW_INTERNAL_WEBHOOKS; });
afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });

describe("QCoreAI: адрес проверяется у самой отправки", () => {
  it("контроль прибора: публичный адрес проходит — это защита, а не глушилка", async () => {
    // Литеральный адрес, а не имя: разрешение имени требует сети, и набор стал
    // бы то зелёным, то красным от чужой доступности.
    const v = await checkPublicUrl("https://8.8.8.8/hook");
    expect(v.ok, "публичный адрес отвергнут").toBe(true);
  });

  it("метаданные облака отвергаются", async () => {
    const v = await checkPublicUrl("http://169.254.169.254/latest/meta-data/");
    expect(v.ok).toBe(false);
  });

  it("имя, ведущее на петлю, отвергается по АДРЕСУ, а не по строке", async () => {
    // localhost разрешается операционной системой, без обращения к серверу имён.
    const v = await checkPublicUrl("http://localhost:9999/hook");
    expect(v.ok, "имя, ведущее внутрь, признано внешним").toBe(false);
    if (!v.ok) expect(v.reason).toBe("url_host_not_public");
  });

  it("отправитель действительно зовёт проверку перед fetch", async () => {
    // Структурная часть намеренно: поведенческий прогон отправки потребовал бы
    // поднимать сервер и управлять DNS. Здесь закрепляется ПОРЯДОК — проверка
    // стоит ДО обращения, иначе она бесполезна.
    const src = (await import("node:fs")).readFileSync(
      new URL("../src/lib/qcoreWebhook.ts", import.meta.url),
      "utf8",
    );
    const check = src.indexOf("checkPublicUrl(target.url)");
    const send = src.indexOf("await fetch(target.url");
    expect(check, "проверка не вызывается вовсе").toBeGreaterThan(0);
    expect(send, "отправка не найдена").toBeGreaterThan(0);
    expect(check, "проверка стоит ПОСЛЕ обращения — она бесполезна").toBeLessThan(send);
  });
});
