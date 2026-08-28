import { describe, test, expect } from "vitest";
import { bundleContents } from "./bundleContents";

describe("обещание про офлайн-пакет соответствует его содержимому", () => {
  test("нет отметки подписи — предупреждаем, что подписи в пакете не будет", () => {
    const b = bundleContents("NO_SIGNED_AT");
    expect(b.hasAevionSignature).toBe(false);
    expect(b.note, "обещание «every proof» осталось безусловным").not.toBeNull();
    expect(String(b.note)).toMatch(/not AEVION|skipped/i);
  });

  test("подпись сойдётся — никакой оговорки", () => {
    expect(bundleContents("OK")).toEqual({ hasAevionSignature: true, note: null });
  });

  test("подпись НЕ сойдётся — это не повод прятать её из пакета", () => {
    // MISMATCH значит «подпись есть и она плохая». Пакет обязан её нести:
    // именно это офлайн-проверка и должна показать третьей стороне.
    const b = bundleContents("MISMATCH");
    expect(b.hasAevionSignature).toBe(true);
    expect(b.note).toBeNull();
  });

  test("признака нет вовсе — обещание не ослабляем", () => {
    expect(bundleContents(undefined).hasAevionSignature).toBe(true);
  });

  test("только один случай из четырёх меняет обещание", () => {
    const changed = (["OK", "NO_SIGNED_AT", "MISMATCH", "ERROR"] as const).filter(
      (r) => bundleContents(r).note !== null,
    );
    expect(changed).toEqual(["NO_SIGNED_AT"]);
  });
});
