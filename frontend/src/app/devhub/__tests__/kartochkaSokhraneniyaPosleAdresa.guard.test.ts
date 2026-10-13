import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pokazyvatKartochkuSokhraneniya, kanalDlyaLista, DEVHUB_SAVE_SOURCE, DEVHUB_SAVE_FEATURE } from "@/lib/devhubSaveCard";

/*
 * 🔴 Волна 132б (13.10.2026). После живого адреса гость DevHub не видел следующего шага (замер пути из
 * Shorts: адрес за 44–60 с, в кадре только тост). Карточка «сохранить сайт — оставьте почту» показывается
 * при адресе и до отправки; шлёт в существующий лист ожидания с source devhub-guest и projectId; считает
 * feature_use devhub_save_email с post; тексты из GEN_UI ru/en/kk, en без кириллицы.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/devhub/[id]/page.tsx"), "utf8");
const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;
const КЛЮЧИ = ["saveTitle", "savePlaceholder", "saveButton", "saveSending", "saveDone", "saveError"];

function блокЯзыка(lang: "ru" | "en" | "kk"): string {
  const i = СТРАНИЦА.indexOf(`\n  ${lang}: {\n    ph:`);
  expect(i, `словарь GEN_UI.${lang}`).toBeGreaterThan(0);
  return СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n  },", i));
}

describe("карточка сохранения после адреса", () => {
  it("🔴 условие показа: есть адрес и почта не оставлена; без адреса, с пустым адресом и после сохранения — нет", () => {
    expect(pokazyvatKartochkuSokhraneniya({ address: "https://x.pages.dev", saved: false })).toBe(true);
    expect(pokazyvatKartochkuSokhraneniya({ address: "https://x.pages.dev", saved: true })).toBe(false);
    expect(pokazyvatKartochkuSokhraneniya({ address: null, saved: false })).toBe(false);
    expect(pokazyvatKartochkuSokhraneniya({ address: "", saved: false })).toBe(false);
    expect(pokazyvatKartochkuSokhraneniya({ address: "not a url", saved: false })).toBe(false);
  });

  it("канал для листа — только то, что пройдёт схему", () => {
    expect(kanalDlyaLista("yt-devhub-1")).toBe("yt-devhub-1");
    expect(kanalDlyaLista("probe-user-99")).toBe("probe-user-99");
    expect(kanalDlyaLista("Telegram")).toBeUndefined();
    expect(kanalDlyaLista("a".repeat(25))).toBeUndefined();
    expect(kanalDlyaLista(null)).toBeUndefined();
  });

  it("🔴 страница: карточка после адреса шлёт в лист ожидания с source devhub-guest и projectId, считает feature_use", () => {
    expect(СТРАНИЦА).toContain("data-devhub-save-card");
    expect(СТРАНИЦА).toContain('apiUrl("/api/constitution/waitlist/subscribe")');
    expect(СТРАНИЦА).toContain("source: DEVHUB_SAVE_SOURCE, projectId: id");
    expect(СТРАНИЦА).toContain('type: "feature_use", source: "devhub", meta: { feature: DEVHUB_SAVE_FEATURE, projectId: id');
    expect(СТРАНИЦА).toContain("pokazyvatKartochkuSokhraneniya({ address: адресСайта, saved: saveHidden })");
    expect(DEVHUB_SAVE_SOURCE).toBe("devhub-guest");
    expect(DEVHUB_SAVE_FEATURE).toBe("devhub_save_email");
    // Карточка стоит ПЕРЕД редактором — в кадре на телефоне и на ноутбуке, без прокрутки.
    expect(СТРАНИЦА.indexOf("data-devhub-save-card")).toBeLessThan(СТРАНИЦА.indexOf("{/* Editor — top 60% */}"));
  });

  it("🔴 словари: шесть ключей в ru/en/kk; en без кириллицы; в JSX карточки нет строковых литералов с кириллицей", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      const блок = блокЯзыка(lang);
      for (const k of КЛЮЧИ) {
        const m = блок.match(new RegExp(`${k}: "([^"]+)"`));
        expect(m, `${lang}.${k}`).not.toBeNull();
        if (lang === "en") expect(КИРИЛЛИЦА.test(m![1]), `${lang}.${k} кириллица`).toBe(false);
      }
    }
    const i = СТРАНИЦА.indexOf("<form data-devhub-save-card");
    const область = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("</form>", i));
    const литералы = область.match(/"[^"\n]*"/g) || [];
    expect(литералы.filter((l) => КИРИЛЛИЦА.test(l))).toEqual([]);
  });
});
