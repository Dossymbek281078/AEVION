// Свой keyFn у ограничителя молча отказывается от нормализации адреса.
//
// НАЙДЕНО 27.08.2026, последний шаг свипа по 44 местам. `rateLimit()` без
// своего keyFn берёт ключ из общего clientIp(), а тот сводит IPv6 к /64 —
// иначе человек получает свежее окно с каждого адреса своей подсети. Но три
// ограничителя в routes/multichat.ts объявили СВОЙ keyFn и написали в нём
// сырой `req.ip`, то есть отказались от нормализации, ничего об этом не сказав:
//
//     keyFn: (req) => `mc:${req.auth?.sub || req.ip || "anon"}`
//
// Первый из трёх стережёт ПЛАТНЫЙ вызов ИИ для анонимного посетителя
// (12 в минуту). Обычная домашняя IPv6-выдача даёт человеку целый /64, то есть
// предел на расход не ограничивал расход.
//
// Тест закрепляет не текст ключей, а СВОЙСТВО: свой keyFn обязан давать тот же
// ключ для адресов одной подсети, что и умолчание.

import { describe, expect, it } from "vitest";
import { clientIp } from "../src/lib/rateLimit";

/** Формулы ключей ровно в том виде, в каком они стоят в multichat.ts. */
const KEYS: Array<[string, (req: { ip?: string; auth?: { sub?: string } }) => string]> = [
  ["dispatch (платный вызов ИИ)", (req) => `mc:${req.auth?.sub || clientIp(req)}`],
  ["dissent preview", (req) => `mc-dissent:${clientIp(req)}`],
  ["receipt verify", (req) => `mc-verify:${clientIp(req)}`],
];

describe("свой keyFn не теряет нормализацию адреса", () => {
  it.each(KEYS)("%s: два адреса одного /64 дают ОДИН ключ", (_name, keyFn) => {
    const a = keyFn({ ip: "2001:db8:abcd:1234::1" });
    const b = keyFn({ ip: "2001:db8:abcd:1234::9999" });
    expect(a).toBe(b);
  });

  it.each(KEYS)("%s: контроль — РАЗНЫЕ подсети остаются разными", (_name, keyFn) => {
    // Иначе «починка» означала бы один предел на всех посетителей мира.
    const a = keyFn({ ip: "2001:db8:abcd:1234::1" });
    const b = keyFn({ ip: "2001:db8:ffff:5678::1" });
    expect(a).not.toBe(b);
  });

  it.each(KEYS)("%s: контроль — разные IPv4 остаются разными", (_name, keyFn) => {
    expect(keyFn({ ip: "203.0.113.7" })).not.toBe(keyFn({ ip: "203.0.113.8" }));
  });
});

describe("у платного вызова ключ по пользователю точнее адреса", () => {
  const dispatch = KEYS[0][1];

  it("вошедший считается по себе, а не по своей подсети", () => {
    // Иначе двое из одной сети делили бы предел, и второй получал бы отказ
    // из-за первого.
    const a = dispatch({ ip: "2001:db8:abcd:1234::1", auth: { sub: "user-A" } });
    const b = dispatch({ ip: "2001:db8:abcd:1234::1", auth: { sub: "user-B" } });
    expect(a).not.toBe(b);
  });

  it("один и тот же вошедший с РАЗНЫХ адресов — один ключ", () => {
    // Обратная сторона: смена сети не должна давать новый предел.
    const a = dispatch({ ip: "203.0.113.7", auth: { sub: "user-A" } });
    const b = dispatch({ ip: "2001:db8::1", auth: { sub: "user-A" } });
    expect(a).toBe(b);
  });

  it("анонимный считается по подсети, и ключ не пустой", () => {
    // Контроль: без адреса и без пользователя ключ обязан остаться
    // осмысленным, а не выродиться в общий для всех.
    const anon = dispatch({ ip: "203.0.113.7" });
    expect(anon).toBe("mc:203.0.113.7");
    expect(dispatch({})).toBe("mc:unknown");
  });
});

describe("сторож на сам модуль, а не на копию формул выше", () => {
  // ⚠️ Проверки выше работают с формулами, ПЕРЕПИСАННЫМИ в этот файл. Они
  // доказывают, что правило верное, но НЕ доказывают, что модуль его
  // соблюдает: верни кто-нибудь `req.ip` в keyFn — и они останутся зелёными.
  // Поэтому отдельно смотрим исходник.

  it("ни один keyFn в multichat не берёт адрес сырым", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../src/routes/multichat.ts", import.meta.url),
      "utf8",
    );

    // Контроль детектора: на образце с дефектом он ОБЯЗАН сработать. Без
    // этого «совпадений нет» означало бы лишь «шаблон не умеет искать».
    const broken = 'keyFn: (req) => `mc:${req.auth?.sub || req.ip || "anon"}`,';
    const raw = /keyFn:[^\n]*\breq\.ip\b/;
    expect(broken).toMatch(raw);

    expect(src).not.toMatch(raw);
  });

  it("контроль: keyFn в модуле вообще есть — сторож смотрит на непустое", async () => {
    // Иначе исчезновение всех ограничителей выглядело бы как «дефектов нет».
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(
      new URL("../src/routes/multichat.ts", import.meta.url),
      "utf8",
    );
    const count = (src.match(/keyFn:/g) || []).length;
    expect(count, `найдено keyFn: ${count}`).toBeGreaterThanOrEqual(3);
  });
});
