// /ru/<приложение> и /kk/<приложение> без своей страницы → тот же адрес без префикса.
// Замер 19.10.2026 22:46: /ru/qsign и /kk/qsign отвечали 404 при живом /en/qsign (308).
import { describe, expect, it } from "vitest";
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
    expect(языковойРедирект("/kk/cyberchess/p/1")).toBeNull();
    expect(языковойРедирект("/qsign")).toBeNull();
    expect(языковойРедирект("/rules")).toBeNull();
    expect(языковойРедирект("/kkk/x")).toBeNull();
    expect(языковойРедирект("/en/qsign")).toBeNull();
  });
  it("/ru/cyberchess у ru своей страницы нет — уводится", () => {
    expect(языковойРедирект("/ru/cyberchess")).toEqual({ цель: "/cyberchess", язык: "ru" });
  });
});
