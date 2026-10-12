import { describe, it, expect } from "vitest";
import {
  vstavitZaglushkuHranilisha,
  PREVIEW_STORAGE_SHIM,
  PODPIS_O_HRANILISHE,
} from "./devhubPreviewStorage";

/**
 * Сторож на замеренный дефект: в превью сгенерированное приложение падало с
 * SecurityError на localStorage (песочница без allow-same-origin), и сохранение
 * молча не работало. Проверяется три вещи: заглушка стоит ДО кода приложения,
 * флаг allow-same-origin не появляется, и сама заглушка действительно хранит.
 */
describe("хранилище в песочнице превью", () => {
  it("скрипт встаёт сразу после <head>, то есть раньше кода приложения", () => {
    const html = '<!DOCTYPE html><html><head><title>t</title></head><body><script>localStorage.setItem("a","1")</script></body></html>';
    const out = vstavitZaglushkuHranilisha(html);
    const iZaglushki = out.indexOf("__aevion_probe__");
    const iPrilozheniya = out.indexOf('localStorage.setItem("a","1")');
    expect(iZaglushki).toBeGreaterThan(-1);
    expect(iPrilozheniya).toBeGreaterThan(-1);
    expect(iZaglushki).toBeLessThan(iPrilozheniya);
  });

  it("документ без <head> не теряет заглушку", () => {
    expect(vstavitZaglushkuHranilisha("<html><body>x</body></html>")).toContain("__aevion_probe__");
    expect(vstavitZaglushkuHranilisha("<p>совсем голый</p>")).toContain("__aevion_probe__");
    expect(vstavitZaglushkuHranilisha("<p>совсем голый</p>")).toContain("совсем голый");
  });

  it("allow-same-origin не добавляется ни в заглушку, ни в подпись", () => {
    expect(PREVIEW_STORAGE_SHIM).not.toContain("allow-same-origin");
    expect(PODPIS_O_HRANILISHE).not.toContain("allow-same-origin");
  });

  it("заглушка действительно хранит, а не делает вид", () => {
    // Выполняем её в окружении, где обращение к localStorage бросает — как в песочнице.
    const okno: any = {};
    Object.defineProperty(okno, "localStorage", {
      configurable: true,
      get() { throw new Error("SecurityError: sandboxed"); },
    });
    Object.defineProperty(okno, "sessionStorage", {
      configurable: true,
      get() { throw new Error("SecurityError: sandboxed"); },
    });
    new Function("window", PREVIEW_STORAGE_SHIM)(okno);
    okno.localStorage.setItem("дело", "купить хлеб");
    expect(okno.localStorage.getItem("дело")).toBe("купить хлеб");
    expect(okno.localStorage.length).toBe(1);
    expect(okno.localStorage.key(0)).toBe("дело");
    okno.localStorage.removeItem("дело");
    expect(okno.localStorage.getItem("дело")).toBeNull();
    expect(okno.localStorage.length).toBe(0);
    expect(okno.sessionStorage.getItem("чего-нет")).toBeNull();
  });

  it("рабочее хранилище НЕ подменяется — на выкаченном адресе остаётся своё", () => {
    const своё: Record<string, string> = {};
    const nastoyashee = {
      getItem: (k: string) => (k in своё ? своё[k] : null),
      setItem: (k: string, v: string) => { своё[k] = v; },
      removeItem: (k: string) => { delete своё[k]; },
      clear: () => {},
      key: () => null,
      length: 0,
      __nastoyashee: true,
    };
    const okno: any = { localStorage: nastoyashee, sessionStorage: nastoyashee };
    new Function("window", PREVIEW_STORAGE_SHIM)(okno);
    expect(okno.localStorage.__nastoyashee).toBe(true);
    // и проба за собой не оставила мусора
    expect(okno.localStorage.getItem("__aevion_probe__")).toBeNull();
  });
});
