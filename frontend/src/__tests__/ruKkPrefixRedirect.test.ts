// /ru/<приложение> и /kk/<приложение> без своей страницы → тот же адрес без префикса.
// Замер 19.10.2026 22:46: /ru/qsign и /kk/qsign отвечали 404 при живом /en/qsign (308).
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { языковойРедирект } from "../middleware";

describe("языковойРедирект", () => {
  it("уводит /ru/qsign и /kk/qsign на /qsign с языком", () => {
    expect(языковойРедирект("/ru/qsign")).toEqual({ цель: "/qsign", язык: "ru" });
    expect(языковойРедирект("/kk/qsign/verify/abc")).toEqual({ цель: "/qsign/verify/abc", язык: "kk" });
    expect(языковойРедирект("/RU")).toEqual({ цель: "/", язык: "ru" });
  });
  it("не трогает свои страницы языка и прочие адреса", () => {
    expect(языковойРедирект("/ru/verify/cert-1")).toBeNull();
    expect(языковойРедирект("/kk/cyberchess")).toBeNull();
    expect(языковойРедирект("/qsign")).toBeNull();
    expect(языковойРедирект("/rules")).toBeNull();
    expect(языковойРедирект("/kkk/x")).toBeNull();
    expect(языковойРедирект("/en/qsign")).toBeNull();
  });
  it("/ru/cyberchess у ru своей страницы нет — уводится", () => {
    expect(языковойРедирект("/ru/cyberchess")).toEqual({ цель: "/cyberchess", язык: "ru" });
  });
  // 24.10.2026: вложенные экраны шахмат на /kk отдавали 404 (своя страница под /kk — только сам /kk/cyberchess)
  it("вложенные экраны шахмат на /kk уводятся на адрес без префикса", () => {
    for (const экран of ["daily", "training", "tournaments", "p/1"]) {
      expect(языковойРедирект(`/kk/cyberchess/${экран}`)).toEqual({ цель: `/cyberchess/${экран}`, язык: "kk" });
    }
  });
  it("каждая страница под src/app/kk не уводится, и только они", () => {
    const корень = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "kk");
    const страницы: string[] = [];
    const обойти = (d: string, путь: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) обойти(join(d, e.name), `${путь}/${e.name}`);
        else if (e.name === "page.tsx") страницы.push(путь);
      }
    };
    обойти(корень, "/kk");
    // контроль прибора: обход видит хотя бы известную страницу
    expect(страницы).toContain("/kk/cyberchess");
    for (const п of страницы) expect(языковойРедирект(п), п).toBeNull();
  });
});
