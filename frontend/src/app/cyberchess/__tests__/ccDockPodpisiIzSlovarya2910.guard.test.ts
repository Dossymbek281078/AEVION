import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tFor } from "../i18n";

/**
 * 29.10.2026, замер прода f4a0c073a на /en/cyberchess: из 31 подписи (aria-label/title)
 * пять шли по-русски — док справа («Задача дня», «Ссылки», «Клавиши»), кнопка звука
 * и кнопка боковой панели. Живой перевод видимый текст ловит, атрибуты — нет.
 * Теперь подписи из словаря i18n.ts.
 */
const КОРЕНЬ = join(process.cwd(), "src/app/cyberchess");
const кир = /[А-Яа-яЁё]/;
// title="…", aria-label="…", ariaLabel="…" и тернарии из строковых литералов внутри {}
function русскиеАтрибуты(src: string): string[] {
  const out: string[] = [];
  const re = /\b(?:title|aria-label|ariaLabel)=(?:"([^"]*)"|\{([^}]*)\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const v = m[1] ?? (m[2].match(/"[^"]*"/g) || []).join(" ");
    if (кир.test(v)) out.push(m[0].slice(0, 80));
  }
  return out;
}

describe("подписи дока и PiP CyberChess — из словаря", () => {
  it("КОНТРОЛЬ: прибор видит прежние русские подписи", () => {
    expect(русскиеАтрибуты('<b aria-label="Закрыть панель"/>')).toHaveLength(1);
    expect(русскиеАтрибуты('<b title={muted ? "Включить звук" : "Выключить звук"}/>')).toHaveLength(1);
    expect(русскиеАтрибуты('<b title={lab(s)} aria-label={t("oshibka.close")}/>')).toHaveLength(0);
  });

  it("WorkspaceDock.tsx: русских литералов в title/aria-label нет", () => {
    expect(русскиеАтрибуты(readFileSync(join(КОРЕНЬ, "WorkspaceDock.tsx"), "utf8"))).toEqual([]);
  });

  // Храповик: в окне PiP осталось 5 редких подписей («Свернуть», «Сменить источник», «Изменить размер»…);
  // новые ключи упираются в предел байт статики page.tsx (znaniyaTrenera…guard). Только вниз.
  it("WorkspacePiP.tsx: русских подписей не больше 5", () => {
    expect(русскиеАтрибуты(readFileSync(join(КОРЕНЬ, "WorkspacePiP.tsx"), "utf8")).length).toBeLessThanOrEqual(5);
  });

  it("page.tsx: кнопки звука и боковой панели без русских литералов", () => {
    const стр = readFileSync(join(КОРЕНЬ, "page.tsx"), "utf8");
    expect(стр).not.toContain('ariaLabel={muted?"Включить звук":"Выключить звук"}');
    expect(стр).not.toContain('aria-label={mobileSidebarOpen?"Свернуть боковую панель"');
    // 30.10, приёмка f2db0ee93 на 390: кнопка покупки в шапке телефона — aria-label «Купить CyberChess · $50/год» на /en.
    expect(стр).not.toContain('aria-label={`Купить CyberChess · ${ccBuyLabel}`}');
    expect(стр).toContain('aria-label={cc.locale==="ru"?`Купить CyberChess · ${ccBuyLabel}`:`${cc.t("buy.card.title")} · ${ccBuyLabelLoc}`}');
  });

  it("ключи есть на en и kk и не совпадают с ru", () => {
    for (const к of ["attr.sound_on", "attr.sound_off", "attr.sidebar_open", "attr.sidebar_close", "attr.sidebar_open_puzzle", "dock.notes", "dock.links", "dock.hotkeys"]) {
      const ru = tFor("ru", к);
      expect(ru, к).not.toBe(к);
      expect(кир.test(tFor("en", к)), `${к} en`).toBe(false);
      expect(tFor("kk", к), `${к} kk`).not.toBe(ru);
    }
  });
});
