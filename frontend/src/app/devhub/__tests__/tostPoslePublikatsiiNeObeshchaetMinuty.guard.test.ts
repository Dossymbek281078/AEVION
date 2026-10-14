import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * 🔴 Волны 133→134 (13.10.2026). Тост после публикации обещает ТОЛЬКО то, что продукт делает (0-ДЕНЬГИ п.3):
 * 133 сняла срок «через несколько минут» по ложному замеру; 134 вернула настоящее обещание — адрес
 * {domain} подключается, срок — из замера Deploy→200 на поддомене (две пробы), все три ветки тоста из
 * словаря ru/en/kk (ветка «DNS готов» была жёстко по-русски), карточка не обещает «получить имя» —
 * оно даётся без почты; почта — чтобы получить ссылку и адрес письмом.
 */
const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/devhub/[id]/page.tsx"), "utf8");
const КИРИЛЛИЦА = /[а-яА-ЯёЁ]/;

function блокЯзыка(lang: "ru" | "en" | "kk"): string {
  const i = СТРАНИЦА.indexOf(`\n  ${lang}: {\n    ph:`);
  expect(i, `словарь GEN_UI.${lang}`).toBeGreaterThan(0);
  return СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n  },", i));
}

describe("тост после публикации: настоящее обещание адреса, из словаря", () => {
  it("🔴 три словаря: domainConnecting/domainDnsReady/keepLink с местом под адрес; en без кириллицы; срок назван", () => {
    for (const lang of ["ru", "en", "kk"] as const) {
      const блок = блокЯзыка(lang);
      for (const k of ["domainConnecting", "domainDnsReady", "keepLink"]) {
        const m = блок.match(new RegExp(`${k}: "([^"]+)"`));
        expect(m, `${lang}.${k}`).not.toBeNull();
        if (lang === "en") expect(КИРИЛЛИЦА.test(m![1]), `${lang}.${k}`).toBe(false);
        if (k !== "keepLink") expect(m![1]).toContain("{domain}");
      }
    }
    const en = блокЯзыка("en").match(/domainConnecting: "([^"]+)"/)![1];
    // Срок — из замера Deploy→200 на поддомене 13–14.10 (две пробы: 134 с и 166 с, обе ≤ 5 мин): «минуты» во всех трёх
    // языках. Сменится замер — менять словарь И эту строку вместе, с новыми числами в комментарии.
    expect(en).toContain("usually within minutes");
    expect(блокЯзыка("ru").match(/domainConnecting: "([^"]+)"/)![1]).toContain("обычно за несколько минут");
    expect(блокЯзыка("kk").match(/domainConnecting: "([^"]+)"/)![1]).toContain("әдетте бірнеше минут ішінде");
    // карточка адреса под кнопкой — та же ветка словаря с подставленным адресом, не отдельный текст
    expect(СТРАНИЦА).toContain("GL.domainConnecting.replace(\"{domain}\", `https://${project.customDomain}`)");
    expect(СТРАНИЦА).not.toMatch(/domainSoon: "/);
  });

  it("🔴 все ветки тоста — из словаря, с настоящим адресом; русской ветки «DNS готов» в коде нет", () => {
    expect(СТРАНИЦА).toContain('${GL.domainDnsReady.replace("{domain}", `https://${d.domain}`)}');
    expect(СТРАНИЦА).toContain('${GL.domainConnecting.replace("{domain}", `https://${d.domain}`)}. ${GL.keepLink}');
    expect(СТРАНИЦА).not.toContain("подключается: DNS готов, сертификат выпускается (1–5 мин), статус обновится сам`");
    expect(СТРАНИЦА).not.toContain("will appear in a few minutes");
  });

  it("карточка не обещает «получить имя» — адрес даётся без почты; почта — ради ссылки и адреса письмом", () => {
    const en = блокЯзыка("en").match(/saveTitle: "([^"]+)"/)![1];
    expect(en).toContain("we send you the link and your own address on aevion.app");
    expect(en).not.toMatch(/get your own name/);
    expect(КИРИЛЛИЦА.test(en)).toBe(false);
  });
});
