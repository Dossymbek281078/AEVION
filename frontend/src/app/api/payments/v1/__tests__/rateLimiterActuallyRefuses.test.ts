import { describe, it, expect } from "vitest";
import { enforceRate } from "../_lib";

/**
 * Сторож: ограничитель темпа действительно ОТКАЗЫВАЕТ.
 *
 * ЗАЧЕМ. Число предела охраняется отдельно — сторож требует, чтобы витрина
 * называла то же число, что применяет код. Но это проверка ФОРМЫ: константа
 * может быть верной, а ограничитель сломанным, и оба сторожа останутся
 * зелёными. Поведенческой проверки у него не было ни одной: соседние тесты
 * подменяют ворота целиком, чтобы проверять своё, и числа 429 в наборе не
 * встречалось вовсе.
 */
function запрос(token: string): never {
  return new Request("https://aevion.app/api/payments/v1/links", {
    headers: { authorization: `Bearer ${token}` },
  }) as never;
}

describe("ограничитель темпа отказывает по достижении предела", () => {
  it("пропускает ровно предел и отбивает следующий", async () => {
    const t = "sk_test_predel_aaaaaaaa";
    for (let i = 1; i <= 3; i++) {
      const r = enforceRate(запрос(t), 3, 60_000);
      expect(r.ok, `запрос ${i} из 3 отбит раньше времени`).toBe(true);
    }
    const лишний = enforceRate(запрос(t), 3, 60_000);
    expect(лишний.ok, "четвёртый запрос прошёл при пределе 3").toBe(false);
    if (!лишний.ok) {
      expect(лишний.response.status).toBe(429);
      const тело = await лишний.response.json();
      expect(тело.error?.type).toBe("rate_limit_error");
    }
  });

  it("сообщает остаток и момент сброса", () => {
    const r = enforceRate(запрос("sk_test_zagolovki_bbbbbbbb"), 5, 60_000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headers["x-ratelimit-limit"]).toBe("5");
      expect(r.headers["x-ratelimit-remaining"]).toBe("4");
      expect(Number(r.headers["x-ratelimit-reset"])).toBeGreaterThan(0);
    }
  });

  it("корзина считается по ключу, а не общая на всех", () => {
    // Так и задумано: у каждого клиента свой предел. Оговорка, которую надо
    // держать в голове: это верно ТОЛЬКО пока ключи настоящие. Пока ключ
    // проверяется по форме, предел обходится сменой строки — вопрос вынесен
    // основателю отдельно, здесь лишь закреплено само устройство.
    const a = "sk_test_pervyi_cccccccc";
    const b = "sk_test_vtoroi_dddddddd";
    for (let i = 0; i < 2; i++) enforceRate(запрос(a), 2, 60_000);
    expect(enforceRate(запрос(a), 2, 60_000).ok, "свой предел не сработал").toBe(false);
    expect(enforceRate(запрос(b), 2, 60_000).ok, "чужой ключ задело чужим счётом").toBe(true);
  });
});
