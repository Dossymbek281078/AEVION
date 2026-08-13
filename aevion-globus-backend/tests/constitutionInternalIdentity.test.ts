import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { internalIdentityHeaders } from "../src/routes/constitutionAi";

// Личность во внутреннем вызове конституции — 13.08.2026.
//
// Конституция зовёт /api/qcoreai/chat и /chat-stream внутренним fetch на
// 127.0.0.1 и передавала только Content-Type. Для лимитера на принимающей
// стороне это означало ОДИН ключ на всех пользователей: аноним с адреса петли.
//
// Важно понимать, почему одной починки лимитера не хватило. Лимитер починен в
// том же дне (считает по аккаунту, когда токен назван), но считать по аккаунту
// он может ТОЛЬКО если вызывающий этот аккаунт передал. MultiChat передаёт,
// конституция — нет, и потому осталась при прежнем дефекте, хотя «класс уже
// починен». Отсюда сторож ниже: проверять надо не наличие функции, а что её
// действительно зовут на каждом внутреннем вызове.

const SRC = readFileSync(join(__dirname, "..", "src", "routes", "constitutionAi.ts"), "utf8");

function reqLike(over: Record<string, unknown> = {}) {
  return { headers: {}, ip: "203.0.113.9", ...over } as never;
}

describe("internalIdentityHeaders", () => {
  test("токен пробрасывается — принимающая сторона сможет считать по аккаунту", () => {
    const h = internalIdentityHeaders(reqLike({ headers: { authorization: "Bearer abc" } }));
    expect(h.Authorization).toBe("Bearer abc");
    expect(h["Content-Type"]).toBe("application/json");
  });

  test("аноним различается по настоящему адресу, а не по адресу петли", () => {
    const h = internalIdentityHeaders(reqLike());
    expect(h["X-Forwarded-For"]).toBe("203.0.113.9");
    expect(h.Authorization).toBeUndefined();
  });

  test("пустой заголовок не превращается в Authorization: ''", () => {
    // Пустая строка на принимающей стороне разбирается как отсутствие токена,
    // но в лог попадёт как «токен был» — лишний повод искать не там.
    const h = internalIdentityHeaders(reqLike({ headers: { authorization: "" } }));
    expect("Authorization" in h).toBe(false);
  });

  test("нет адреса — нет и заголовка (пустой XFF хуже отсутствующего)", () => {
    const h = internalIdentityHeaders(reqLike({ ip: undefined }));
    expect("X-Forwarded-For" in h).toBe(false);
  });
});

describe("сторож: каждый внутренний вызов несёт личность", () => {
  test("число fetch совпадает с числом проброшенных личностей", () => {
    // Первая версия этого сторожа искала «127.0.0.1» В СТРОКЕ с fetch( — и
    // нашла один вызов из двух: первый собирает адрес в переменную `url`, а
    // литерал стоит строкой выше. Тот самый случай, когда шаблон судит по
    // тексту вызова, а адрес приходит через переменную.
    //
    // Поэтому инвариант счётный: в этом файле ВСЕ исходящие вызовы внутренние,
    // значит у каждого fetch должен быть проброс личности. Добавят новый без
    // него — числа разойдутся, независимо от того, как записан адрес.
    const fetches = SRC.split("fetch(").length - 1;
    const identities = SRC.split("headers: internalIdentityHeaders(").length - 1;

    expect(fetches).toBeGreaterThanOrEqual(2);
    expect(identities).toBe(fetches);
  });

  test("оба известных внутренних адреса на месте", () => {
    // Чтобы счётный инвариант нельзя было удовлетворить, удалив вызовы.
    expect(SRC).toMatch(/127\.0\.0\.1:\$\{port\}\/api\/qcoreai\/chat`/);
    expect(SRC).toMatch(/127\.0\.0\.1:\$\{port\}\/api\/qcoreai\/chat-stream`/);
  });
});
