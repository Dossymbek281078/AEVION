import { describe, test, expect } from "vitest";
import { denyAudience } from "../src/lib/planGate";
import type { ResolvedPlan } from "../src/lib/planGate";

/**
 * Выбор аудитории — три строки кода, и именно они решают, попадёт обход
 * роботами в «спрос» или нет. Без этих проверок мутация
 * `plan.email ? ... : ...` выживала бы: сквозной тест гоняет только
 * анонимную ветку, потому что собрать подписанный токен он не может.
 */
const план = (email: string | null): ResolvedPlan => ({
  tier: "free",
  rawTier: "free",
  email,
  reason: "default",
  chosenModules: [],
});

describe("кто упёрся в стену", () => {
  test("без учётной записи — аноним", () => {
    expect(denyAudience(план(null))).toBe("anonymous");
  });

  test("с учётной записью — registered, даже на бесплатном тарифе", () => {
    // Тариф у обоих `free`: различает НАЛИЧИЕ адреса, а не тариф. Раньше эти
    // два случая были неразличимы, и оба ложились в одну цифру.
    expect(denyAudience(план("kto-to@example.com"))).toBe("registered");
  });

  test("пустая строка вместо адреса — тоже аноним, а не «есть аккаунт»", () => {
    // Пустая строка ложна в JS, и это ровно то поведение, которое нужно:
    // адреса нет. Проверка стоит здесь, чтобы замена `plan.email` на
    // `plan.email != null` не проехала молча.
    expect(denyAudience(план(""))).toBe("anonymous");
  });
});
