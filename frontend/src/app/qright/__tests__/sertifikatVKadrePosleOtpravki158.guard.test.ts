import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 158 (18.10.2026). Прибор полного пути (156) на проде: после «Protect My Work» сертификат создаётся на всех
 * 5 парах окон, но кадр стоит на НИЗЕ карточки (кнопки Download PDF / Verify, тост «Your work is now protected!»),
 * а заголовок сертификата и хэш — выше кадра на 858–1618 px. Человек нажал — и видит кнопки, а не результат.
 * Правка: блок «done» получает ref и после setStep("done") прокручивается к своей шапке на следующем кадре
 * (карточка монтируется после смены шага). Пиксели на проде меряет 156-polnyj-put.cjs: результат «вКадре=true».
 */
const src = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("158: после отправки сертификат показывается с шапки, а не с кнопок внизу", () => {
  test("🔴 блок результата имеет ref и запас под липкую шапку", () => {
    expect(src.split('<div ref={doneRef} data-qright-done style={{ scrollMarginTop: 84 }}>').length - 1).toBe(1);
    expect(src).toContain("const doneRef = useRef<HTMLDivElement | null>(null);");
  });

  test("🔴 прокрутка к шапке вызывается сразу после setStep(\"done\") в обработчике отправки, на следующем кадре", () => {
    const done = src.indexOf('setStep("done");');
    expect(done).toBeGreaterThan(0);
    const хвост = src.slice(done, done + 600);
    expect(хвост).toMatch(/requestAnimationFrame\(\(\) => doneRef\.current\?\.scrollIntoView\(\{ block: "start"/);
    // прокрутка не должна стоять ДО смены шага — тогда блока ещё нет в DOM и ref пуст
    const scroll = src.indexOf("doneRef.current?.scrollIntoView");
    expect(scroll).toBeGreaterThan(done);
  });

  test("контроль: сброс формы («Protect Another Work») блок результата не прокручивает", () => {
    const сброс = src.indexOf("setResult(null);");
    expect(сброс).toBeGreaterThan(0);
    expect(src.slice(сброс, сброс + 400)).not.toContain("scrollIntoView");
  });
});
