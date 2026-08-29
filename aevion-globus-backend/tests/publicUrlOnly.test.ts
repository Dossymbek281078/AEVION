import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPublicUrl, isPrivateAddress } from "../src/lib/publicUrlOnly";

/**
 * `POST /api/devhub/media/upload-audio` брал `sourceUrl` из тела и делал
 * `fetch` без единой проверки. Закрыто это было СЛУЧАЙНО — ручка отвечает 503,
 * пока не настроено хранилище. Настроят — и посторонний заставит наш сервер
 * ходить внутрь сети, получая ответ кодом статуса.
 */

describe("наружу можно, внутрь нельзя", () => {
  it("контроль: обычный внешний адрес проходит", async () => {
    const v = await checkPublicUrl("https://example.com/a.mp3");
    expect(v.ok, "внешний адрес обязан проходить, иначе это глушилка").toBe(true);
  });

  it("петля и внутренние адреса не проходят", async () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://localhost/x",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.16.0.9/x",
      "http://169.254.169.254/latest/meta-data/",  // метаданные облака
      "http://[::1]/x",
    ]) {
      const v = await checkPublicUrl(u);
      expect(v.ok, `внутренний адрес прошёл: ${u}`).toBe(false);
    }
  });

  it("чужие схемы не проходят", async () => {
    for (const u of ["file:///etc/passwd", "ftp://example.com/a", "gopher://x"]) {
      const v = await checkPublicUrl(u);
      expect(v.ok, `схема прошла: ${u}`).toBe(false);
      if (!v.ok) expect(v.reason).toBe("url_scheme_not_allowed");
    }
  });

  it("логин с паролем в адресе не проходит", async () => {
    const v = await checkPublicUrl("http://user:pass@example.com/a");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("url_credentials_not_allowed");
  });

  it("разбор диапазонов: проверяем саму таблицу, а не только адреса", () => {
    expect(isPrivateAddress("8.8.8.8", 4)).toBe(false);
    expect(isPrivateAddress("1.1.1.1", 4)).toBe(false);
    expect(isPrivateAddress("::ffff:10.1.2.3", 6), "IPv4 внутри IPv6").toBe(true);
    expect(isPrivateAddress("fd00::1", 6), "unique-local").toBe(true);
    expect(isPrivateAddress("fe80::1", 6), "link-local").toBe(true);
    expect(isPrivateAddress("2606:4700::1111", 6), "публичный IPv6").toBe(false);
  });

  it("ручка ДЕЙСТВИТЕЛЬНО зовёт проверку, а не просто импортирует", () => {
    const src = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
    const i = src.indexOf('"/media/upload-audio"');
    expect(i, "ручка не найдена — тест смотрит не туда").toBeGreaterThan(0);
    // Граница по следующему объявлению маршрута, а не по длине: иначе
    // окно либо не достанет до предмета, либо захватит соседний обработчик
    // и покажет чужую проверку как нашу.
    const end = src.indexOf("devhubRouter.", i + 10);
    expect(end, "граница обработчика не найдена").toBeGreaterThan(i);
    const block = src.slice(i, end);
    // ⚠️ Держит сторожа НЕ эта строка. Проверка наличия ИМЕНИ переживает
    // обезвреживание: имя остаётся в импорте после удаления вызова.
    // Настоящая опора — следующее утверждение: fetch идёт по verdict.url,
    // а его нельзя оставить, убрав вызов (переменной не станет, упадёт сборка).
    // Замечено соседней вкладкой, которая на этом сама обожглась 29.08.
    expect(block.includes("checkPublicUrl"), "проверка не вызывается в обработчике").toBe(true);
    expect(
      block.includes("fetch(verdict.url"),
      "fetch идёт по СЫРОМУ адресу, а не по проверенному",
    ).toBe(true);
  });
});
