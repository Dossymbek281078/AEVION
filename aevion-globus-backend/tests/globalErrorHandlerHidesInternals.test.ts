import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { makeHttpErrorHandler } from "../src/lib/httpErrorHandler";

/**
 * Общий перехватчик ошибок закрывает то, что не закрыл обработчик маршрута.
 *
 * Написан по следам собственной ошибки. 21.08.2026 я замерил утечку внутренних
 * сообщений (28 ручек) и заодно объявил, что «у приложения НЕТ общего
 * перехватчика». Это было неверно: он есть, `makeHttpErrorHandler()` в конце
 * index.ts, и мой греп его просто не нашёл — искал только форму `app.use((err`.
 *
 * Две ручки в том замере «текли» лишь потому, что зонд поднимал ОДИН РОУТЕР,
 * без общих middleware приложения. То есть прибор мерил не ту сборку.
 *
 * Тест закрепляет обе стороны: перехватчик существует и не пропускает наружу
 * ни сообщение, ни стек. Если его однажды снимут с приложения, эта проверка
 * останется зелёной — она про сам перехватчик; за его подключение отвечает
 * отдельная строка ниже.
 */

function appWithHandler(boom: unknown) {
  const a = express();
  a.get("/x", () => {
    throw boom;
  });
  a.use(makeHttpErrorHandler(() => {}));
  return a;
}

describe("общий перехватчик", () => {
  test("не отдаёт текст внутренней ошибки", async () => {
    const res = await request(
      appWithHandler(new Error("connect ECONNREFUSED db-prod-7.internal:5432 user=aevion_app")),
    ).get("/x");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal_error" });
    const whole = JSON.stringify(res.body) + String(res.text ?? "");
    expect(whole).not.toMatch(/ECONNREFUSED|internal:5432|user=aevion_app/);
  });

  test("не отдаёт стек", async () => {
    const e = new Error("boom");
    const res = await request(appWithHandler(e)).get("/x");
    const whole = JSON.stringify(res.body) + String(res.text ?? "");
    expect(whole).not.toMatch(/at Object|\.ts:\d+|node_modules/);
  });

  test("сообщает об ошибке наблюдению", async () => {
    // Молчаливый 500 хуже громкого: о нём никто не узнает.
    const seen: unknown[] = [];
    const a = express();
    a.get("/x", () => {
      throw new Error("boom");
    });
    a.use(makeHttpErrorHandler((err) => {
      seen.push(err);
    }));
    await request(a).get("/x");
    expect(seen.length).toBe(1);
  });

  test("перехватчик ПОДКЛЮЧЁН к приложению", () => {
    // Сам по себе он бесполезен, если его забыли повесить. Проверяем по
    // исходнику: тест про поведение выше остался бы зелёным и без подключения.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "index.ts"),
      "utf8",
    );
    // Построчно и БЕЗ комментариев: закомментированная строка содержит тот же
    // текст, и шаблон по всему файлу остался бы зелёным на отключённом
    // перехватчике. Проверено мутацией — первая версия так и повела себя.
    const mounted = src
      .split(String.fromCharCode(10))
      .some((l: string) => {
        const t = l.trim();
        return !t.startsWith("//") && t.includes("app.use(makeHttpErrorHandler())");
      });
    expect(mounted, "перехватчик не подключён к приложению").toBe(true);
  });
});
