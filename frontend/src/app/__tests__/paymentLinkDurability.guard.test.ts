/**
 * Сторож: страница платёжных ссылок не обещает того, чего хранилище не может.
 *
 * Проверяется ДВА разных утверждения, и это намеренно:
 *   1) чистая логика (`durability.ts`) — что решение верное;
 *   2) сама страница — что она это решение СПРАШИВАЕТ.
 *
 * Второе нужно, потому что первое можно оставить зелёным, вырезав вызов со
 * страницы: модуль останется правильным, а человек снова увидит «Never».
 * Это класс «правда останавливается на границе» — поле есть, читателя нет.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  readPersistence,
  durabilityNotice,
  isExpiryAllowed,
  coerceExpiry,
} from "../payments/links/durability";

const PAGE = path.join(process.cwd(), "src/app/payments/links/page.tsx");

describe("платёжные ссылки: обещание не сильнее хранилища", () => {
  it("kv — предупреждать не о чем, «никогда» доступно", () => {
    const n = durabilityNotice("kv");
    expect(n.warn).toBe(false);
    expect(n.allowNever).toBe(true);
    expect(n.text).toBe("");
  });

  it("memory — предупреждаем и запрещаем «никогда»", () => {
    const n = durabilityNotice("memory");
    expect(n.warn).toBe(true);
    expect(n.allowNever).toBe(false);
    // Текст обязан называть ПОСЛЕДСТВИЕ для плательщика, а не только факт
    // «хранится в памяти»: продавец видит ссылку живой у себя и без этой
    // фразы не поймёт, что сломалось именно у покупателя.
    expect(n.text).toMatch(/плательщик/i);
    expect(n.text).toMatch(/перезапуск/i);
  });

  it("неизвестное состояние — это НЕ «всё хорошо»", () => {
    // Третий исход. Если бы «не знаю» приравняли к «kv», страница молча
    // обещала бы долговечность при недоступном /api/health.
    const n = durabilityNotice("unknown");
    expect(n.warn).toBe(true);
    expect(n.allowNever).toBe(false);
  });

  it("разбор ответа: всё, кроме kv/memory, — «не знаю»", () => {
    expect(readPersistence("kv")).toBe("kv");
    expect(readPersistence("memory")).toBe("memory");
    for (const bad of [undefined, null, "", "KV", "redis", 0, {}, []]) {
      expect(readPersistence(bad)).toBe("unknown");
    }
  });

  it("срок «никогда» запрещён везде, кроме kv; конечные сроки — всегда", () => {
    expect(isExpiryAllowed(0, "kv")).toBe(true);
    expect(isExpiryAllowed(0, "memory")).toBe(false);
    expect(isExpiryAllowed(0, "unknown")).toBe(false);
    for (const p of ["kv", "memory", "unknown"] as const) {
      for (const d of [1, 7, 30]) expect(isExpiryAllowed(d, p)).toBe(true);
    }
  });

  it("недопустимый срок приводится к конечному, допустимый не трогается", () => {
    expect(coerceExpiry(0, "memory")).toBe(7);
    expect(coerceExpiry(0, "unknown")).toBe(7);
    expect(coerceExpiry(0, "kv")).toBe(0);
    expect(coerceExpiry(30, "memory")).toBe(30);
  });

  it("страница действительно спрашивает состояние хранилища", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    // Ручка, у которой спрашиваем.
    expect(src).toContain("/api/health");
    expect(src).toContain("durabilityNotice");
    // ЗАКРЕПЛЯЕМ СВЯЗКУ, А НЕ НАЛИЧИЕ ИМЕНИ. Первая версия требовала просто
    // строку "readPersistence" — и мутация, заменившая вызов на
    // `setPersistence("kv")`, прошла НЕЗАМЕЧЕННОЙ: имя осталось в строке
    // импорта. Проверка была зелёной на сломанном коде, то есть охраняла не
    // то, что обещает её название.
    expect(src).toContain("setPersistence(readPersistence(");
    // И ни одного места, где состояние назначается литералом в обход ответа.
    expect(src).not.toMatch(/setPersistence\(\s*["'](kv|memory)["']\s*\)/);
  });

  it("предупреждение действительно рисуется, а не только вычисляется", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    // Найдено мутацией: `{durability.warn ? (` → `{false ? (` проходило
    // незамеченным. Решение вычислялось верно и никуда не выводилось —
    // «правда останавливается на границе», только внутри одного файла.
    expect(src).toContain("{durability.warn ? (");
    expect(src).toContain("{durability.text}");
    // Подсказка на погашенной кнопке — тоже вывод, а не расчёт.
    expect(src).toContain("durability.neverHint");
  });

  it("страница не предлагает «Never» в обход проверки", () => {
    const src = fs.readFileSync(PAGE, "utf8");
    // Единственный источник списка сроков — модуль. Зашитый рядом с "Never"
    // массив означал бы вторую, неохраняемую дорогу к тому же обещанию.
    expect(src).toContain("EXPIRY_CHOICES_DAYS");
    expect(src).not.toMatch(/\[\s*1\s*,\s*7\s*,\s*30\s*,\s*0\s*\]/);
  });
});
