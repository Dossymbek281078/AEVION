import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: готовность провайдера считается в ОДНОМ месте — в его модуле.
 *
 * ЗАЧЕМ. 29.08.2026 одно утверждение о мире жило в трёх написаниях, и одно из
 * них разошлось: модуль PayBox требовал И продавца, И секрета, а
 * /api/payments/health пересобирал готовность по одному продавцу. Сегодня оба
 * отвечали «не настроен», и разница была невидима — она проявилась бы ровно в
 * день ЧАСТИЧНОЙ настройки, когда одна ручка объявит кассу для тенге готовой,
 * а платить будет нельзя.
 *
 * Одинаковые выражения не спасают: они расходятся при первой правке одного из
 * них. Спасает общий ВЫЗОВ.
 *
 * ГРАНИЦА. Сторож смотрит на переменные, у которых есть свой модуль-владелец
 * с функцией готовности. Он не судит про остальные `process.env` — там своя
 * жизнь, и правило «всё через функцию» было бы вредным.
 */
const SRC = join(__dirname, "..", "src");

/** переменная → файл-владелец, которому МОЖНО её читать напрямую. */
const ВЛАДЕЛЬЦЫ: Record<string, string> = {
  PAYBOX_MERCHANT_ID: "lib/payment/payboxProvider.ts",
  PAYBOX_SECRET: "lib/payment/payboxProvider.ts",
  PAYPAL_CLIENT_ID: "lib/payment/paypalProvider.ts",
  PAYPAL_SECRET: "lib/payment/paypalProvider.ts",
};

function файлы(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const full = join(dir, n);
    if (statSync(full).isDirectory()) файлы(full, out);
    else if (n.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("готовность провайдера не пересобирают на стороне", () => {
  it("никто, кроме модуля-владельца, не считает готовность из env", () => {
    const все = файлы(SRC);
    expect(все.length, "обход не нашёл исходников — сломан сам сторож").toBeGreaterThan(100);

    const нарушения: string[] = [];
    for (const f of все) {
      const rel = f.slice(f.indexOf("src") + 4).split(String.fromCharCode(92)).join("/");
      const текст = readFileSync(f, "utf8");
      for (const [env, владелец] of Object.entries(ВЛАДЕЛЬЦЫ)) {
        if (rel === владелец) continue;
        // Ловим именно ВЫЧИСЛЕНИЕ готовности: Boolean(process.env.X
        if (текст.includes(`Boolean(process.env.${env}`)) {
          нарушения.push(`${rel}: считает готовность из ${env} сам — зовите функцию из ${владелец}`);
        }
      }
    }
    expect(
      нарушения,
      "Готовность провайдера пересобрана на стороне. Одинаковые выражения\n" +
        "расходятся при первой правке одного из них — именно так 29.08\n" +
        "/api/payments объявлял PayBox готовым по одному продавцу.\n  " +
        нарушения.join("\n  "),
    ).toEqual([]);
  });
});
