/*
 * Бесплатный сертификат — первое, что получает гость QRight, и единственное,
 * что отличает «за платной стеной» от «попробовал и купил». Замер 12.10.2026:
 * форма в 1359 px от верха на 1463×724, кнопки к ней не было — гость видел
 * только «от $200/мес». Сторож держит связку «кнопка в шапке → форма».
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "page.tsx"), "utf8");

describe("QRight: путь к бесплатной форме из шапки", () => {
  it("в шапке есть кнопка на якорь формы, и форма этот якорь носит", () => {
    const кнопка = /href="#([a-z-]+)"\s+data-testid="qright-jump-to-form"/.exec(SRC);
    expect(кнопка, "кнопки к форме в шапке нет").toBeTruthy();
    const якорь = кнопка![1];
    expect(SRC, `форма не носит id="${якорь}" — кнопка ведёт в никуда`).toMatch(
      new RegExp(`<form id="${якорь}" onSubmit=\{submit\}`),
    );
  });

  it("кнопка стоит ВЫШЕ приёма адресов, а не под ним", () => {
    const кнопка = SRC.indexOf('data-testid="qright-jump-to-form"');
    const приём = SRC.indexOf("<WaitlistCapture");
    expect(кнопка).toBeGreaterThan(0);
    expect(приём).toBeGreaterThan(0);
    expect(кнопка).toBeLessThan(приём);
  });
});
