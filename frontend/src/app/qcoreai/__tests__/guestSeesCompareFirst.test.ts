import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GUEST_COMPARE_EXAMPLE, exampleFor, startStrategy } from "../multi/guestExamples";

/**
 * Гость с ролика yt-0411-2 («один вопрос — несколько моделей») видит сравнение
 * с первого экрана: режим Parallel и вопрос из ролика под карточкой. Вошедший
 * пользователь остаётся на своём режиме и своих примерах.
 */
describe("первый экран /qcoreai/multi для гостя", () => {
  test("гость открывает Parallel, вошедший — auto", () => {
    expect(startStrategy(false)).toBe("parallel");
    expect(startStrategy(true)).toBe("auto");
  });

  test("гостю у Parallel — вопрос из ролика, у остальных карточек и у вошедшего — прежний пример", () => {
    expect(exampleFor("parallel", "old", false)).toBe(GUEST_COMPARE_EXAMPLE);
    expect(exampleFor("parallel", "old", true)).toBe("old");
    expect(exampleFor("sequential", "old", false)).toBe("old");
    expect(exampleFor("debate", "old", false)).toBe("old");
  });

  test("вопрос из ролика совпадает с записью (скрипты/rec.mjs)", () => {
    expect(GUEST_COMPARE_EXAMPLE).toBe("React или HTML для первого проекта?");
  });

  test("страница берёт режим и пример из guestExamples, а не держит свои", () => {
    const src = fs.readFileSync(path.join(__dirname, "../multi/page.tsx"), "utf8");
    expect(src).toContain('from "./guestExamples"');
    expect(src).toContain("startStrategy(t)");
    expect(src).toContain("exampleFor(c.id, c.example, signedIn)");
  });
});
