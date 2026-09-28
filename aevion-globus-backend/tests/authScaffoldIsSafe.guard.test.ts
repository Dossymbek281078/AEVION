import { describe, it, expect } from "vitest";
import { файлыВхода, ЗАВИСИМОСТИ_ВХОДА, УКАЗАНИЕ_ПРО_ВХОД } from "../src/lib/devhubAuthScaffold";

/**
 * Вход пользователей мы отдаём ГОТОВЫМ шаблоном, а не просим модель написать его
 * заново. Причина в цене ошибки: здесь она стоит не «некрасиво», а «утекли пароли
 * чужих людей». Значит шаблон обязан выдерживать проверку по пунктам — иначе мы
 * раздадим дыру сразу всем приложениям, которые соберёт DevHub.
 *
 * Проверки ниже — свойства, а не косметика: каждая соответствует известному способу
 * взлома (подбор по времени ответа, перебор почт, кража cookie скриптом, SQL-вставка,
 * предсказуемый токен сессии, вечная сессия).
 */
const файлы = файлыВхода();
const текст = (путь: string) => {
  const ф = файлы.find((f) => f.path === путь);
  expect(ф, `нет файла ${путь}`).toBeTruthy();
  return ф!.content;
};
const весьКод = файлы.map((f) => f.content).join("\n");

describe("шаблон входа: прибор", () => {
  it("файлы на месте и непустые", () => {
    expect(файлы.length).toBe(6);
    for (const ф of файлы) expect(ф.content.length, ф.path).toBeGreaterThan(80);
  });

  it("зависимости названы: без них шаблон не заработает", () => {
    expect(ЗАВИСИМОСТИ_ВХОДА.bcryptjs).toBeTruthy();
    expect(ЗАВИСИМОСТИ_ВХОДА.pg).toBeTruthy();
  });
});

describe("шаблон входа: пароли", () => {
  it("пароль хешируется, а не хранится", () => {
    const auth = текст("lib/auth.js");
    expect(auth).toContain("bcrypt.hash");
    expect(auth).toContain("password_hash");
    // в таблицу не должно уезжать поле с самим паролем
    expect(текст("db/schema.sql")).not.toMatch(/\bpassword\s+TEXT/i);
  });

  it("пароль нигде не попадает в журнал", () => {
    // console.error(..., password) — самый частый способ слить пароли в логи
    expect(весьКод).not.toMatch(/console\.(log|error|warn)\([^)]*password[^)]*\)/);
  });

  it("короткий пароль не принимается", () => {
    const auth = текст("lib/auth.js");
    expect(auth).toContain("MIN_PASSWORD");
    expect(auth).toMatch(/MIN_PASSWORD\s*=\s*([89]|[1-9]\d)/);
  });
});

describe("шаблон входа: что видно постороннему", () => {
  it("ответ один и тот же на «нет почты» и «неверный пароль»", () => {
    const login = текст("pages/api/auth/login.js");
    const ответы = login.match(/error:\s*'[^']+'/g) ?? [];
    const проОшибкеВхода = ответы.filter((s) => !s.includes("method_not_allowed"));
    // ровно один текст ошибки на оба случая — иначе по нему перебирают почты
    expect(new Set(проОшибкеВхода).size).toBe(1);
  });

  it("хеш считается даже когда пользователя нет (иначе видно по времени ответа)", () => {
    const auth = текст("lib/auth.js");
    expect(auth).toMatch(/row \? row\.password_hash : '\$2[aby]\$/);
    expect(auth).toContain("bcrypt.compare");
  });
});

describe("шаблон входа: сессии", () => {
  it("токен случайный, а не предсказуемый", () => {
    const auth = текст("lib/auth.js");
    expect(auth).toContain("crypto.randomBytes(32)");
    expect(auth).not.toContain("Math.random");
  });

  it("cookie недоступна чужому скрипту и чужому сайту", () => {
    const auth = текст("lib/auth.js");
    expect(auth).toContain("HttpOnly");
    expect(auth).toContain("SameSite=Lax");
    expect(auth).toContain("Secure");
  });

  it("сессия истекает, а просроченная не пускает", () => {
    expect(текст("db/schema.sql")).toContain("expires_at");
    expect(текст("lib/auth.js")).toContain("s.expires_at > NOW()");
  });

  it("выход действительно закрывает сессию, а не только чистит cookie", () => {
    expect(текст("lib/auth.js")).toContain("DELETE FROM sessions");
    expect(текст("pages/api/auth/logout.js")).toContain("endSession");
  });
});

describe("шаблон входа: база", () => {
  it("все запросы параметризованы — никакой склейки строк в SQL", () => {
    const auth = текст("lib/auth.js");
    for (const запрос of auth.match(/pool\.query\([^)]*\)/gs) ?? []) {
      expect(запрос, "склейка в SQL").not.toMatch(/'\s*\+|\+\s*'|\$\{/);
    }
    expect(auth).toContain("$1");
  });

  it("почта хранится в одном виде и уникальна", () => {
    expect(текст("lib/auth.js")).toContain("toLowerCase()");
    expect(текст("db/schema.sql")).toMatch(/email\s+TEXT NOT NULL UNIQUE/);
  });

  it("занятая почта — честный 409, а не пятисотка", () => {
    expect(текст("pages/api/auth/register.js")).toContain("23505");
  });
});

describe("шаблон входа: модель не должна писать свой", () => {
  it("указание модели называет готовые ручки и запрещает второй вход", () => {
    expect(УКАЗАНИЕ_ПРО_ВХОД).toContain("ALREADY implemented");
    expect(УКАЗАНИЕ_ПРО_ВХОД).toContain("Do NOT write your own authentication");
    for (const ручка of ["/api/auth/register", "/api/auth/login", "/api/auth/me", "/api/auth/logout"]) {
      expect(УКАЗАНИЕ_ПРО_ВХОД, ручка).toContain(ручка);
    }
  });
});
