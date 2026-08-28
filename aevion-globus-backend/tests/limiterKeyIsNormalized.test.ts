// Ограничитель частоты на регистрации работ обходился подбором адреса.
//
// НАЙДЕНО 27.08.2026. У помощника `clientIp` в проекте ДВЕ копии. В
// lib/rateLimit.ts адрес проходит через normalizeAddressForKey (схлопывает
// IPv6 до /64), а во второй копии — lib/rateLimit/inMemoryWindow.ts —
// возвращался сырым. При этом её собственный комментарий утверждал: «Same rule
// as clientIp() in lib/rateLimit.ts». Утверждение перестало быть правдой, а
// проверить его было нечем.
//
// Следствие: у обычной домашней IPv6-выдачи весь /64 в распоряжении одного
// человека. Каждый запрос с нового адреса получал СВЕЖЕЕ окно, то есть предел
// «20 регистраций в минуту» на /api/pipeline/protect не ограничивал ничего —
// и снаружи выглядел работающим.

import { describe, expect, it } from "vitest";
import { clientIp as windowClientIp } from "../src/lib/rateLimit/inMemoryWindow";
import {
  clientIp as sharedClientIp,
  normalizeAddressForKey,
} from "../src/lib/rateLimit";

const req = (ip?: string) => ({ ip, headers: {} as Record<string, string> });

describe("две копии правила дают ОДИН ключ", () => {
  const addresses = [
    "203.0.113.7",
    "2001:db8:abcd:1234::1",
    "2001:db8:abcd:1234::beef",
    "::1",
    "127.0.0.1",
  ];

  it.each(addresses)("%s — обе копии согласны", (ip) => {
    expect(windowClientIp(req(ip))).toBe(sharedClientIp({ ip }));
  });

  it("адреса нет — обе копии говорят unknown", () => {
    expect(windowClientIp(req(undefined))).toBe("unknown");
    expect(sharedClientIp({})).toBe("unknown");
  });
});

describe("IPv6 из одной подсети попадает в ОДИН бакет", () => {
  it("два адреса одного /64 дают одинаковый ключ", () => {
    // Главный случай. До правки ключи различались, и человек получал столько
    // свежих окон, сколько адресов у него в подсети.
    const a = windowClientIp(req("2001:db8:abcd:1234::1"));
    const b = windowClientIp(req("2001:db8:abcd:1234::9999"));
    expect(a).toBe(b);
  });

  it("контроль: РАЗНЫЕ подсети остаются разными ключами", () => {
    // Без этого проверка выше прошла бы и на функции, возвращающей константу,
    // а тогда все пользователи мира делили бы один предел на всех.
    const a = windowClientIp(req("2001:db8:abcd:1234::1"));
    const b = windowClientIp(req("2001:db8:ffff:5678::1"));
    expect(a).not.toBe(b);
  });

  it("контроль: разные адреса IPv4 остаются разными ключами", () => {
    expect(windowClientIp(req("203.0.113.7"))).not.toBe(
      windowClientIp(req("203.0.113.8")),
    );
  });

  it("нормализация вообще что-то делает с IPv6", () => {
    // Отрицательный контроль на сам приём: если бы normalizeAddressForKey
    // возвращала вход как есть (так бывает при отсутствии пакета — там catch),
    // все проверки выше молча ослабли бы. Тогда об этом надо знать.
    expect(normalizeAddressForKey("2001:db8:abcd:1234::1")).not.toBe(
      "2001:db8:abcd:1234::1",
    );
  });
});
