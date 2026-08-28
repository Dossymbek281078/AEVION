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

import { ed25519FieldNote } from "./bundleContents";

describe("подпись под полем Ed25519 не обещает невозможного", () => {
  test("старая схема — прямо сказано, что проверить нельзя НИКОМУ", () => {
    const t = ed25519FieldNote("NO_SIGNED_AT");
    expect(t, "поле зовёт в пакет, где подписи нет").not.toMatch(/download the verification bundle/i);
    expect(t).toMatch(/cannot be reconstructed/i);
    // И названо, что ПРОВЕРИТЬ всё же можно: иначе запись читается как пустая.
    expect(t).toMatch(/content hash|Bitcoin anchor/i);
  });

  test("нынешняя схема — зовём в пакет, там подпись есть", () => {
    const t = ed25519FieldNote("OK");
    expect(t).toMatch(/download the verification bundle/i);
    expect(t).not.toMatch(/cannot be reconstructed/i);
  });

  test("два случая дают два разных текста", () => {
    expect(ed25519FieldNote("NO_SIGNED_AT")).not.toBe(ed25519FieldNote("OK"));
  });

  test("ни один случай не оставляет поле без объяснения", () => {
    for (const r of ["OK", "NO_SIGNED_AT", "MISMATCH", "ERROR", undefined] as const) {
      expect(ed25519FieldNote(r).length, `пусто при ${r}`).toBeGreaterThan(80);
    }
  });
});
