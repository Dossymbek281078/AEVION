/**
 * 🔴 19.10.2026 — бренд бюро на странице проверки (обещано письмами WPK и Central
 * Illustration Agency). Строка «Запись сделана через <Бюро> · проверку обеспечивает
 * AEVION» рисуется ТОЛЬКО при заполненном поле partner; без партнёра страница — как
 * прежде (ни пустой строки, ни «undefined»).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = readFileSync(join(__dirname, "..", "[id]", "page.tsx"), "utf8");

describe("бренд бюро на /verify (19.10.2026)", () => {
  it("тип ответа знает поле partner", () => {
    expect(SRC).toContain("partner?: string | null;");
  });
  it("строка партнёра рисуется только при заполненном поле и несёт обе подписи", () => {
    expect(SRC).toContain("{cert.partner ? (");
    expect(SRC).toContain('data-testid="cert-partner"');
    // 19.10 вечер: строка идёт через словарь tv(lang, …) — ru «Запись сделана через … · проверку обеспечивает AEVION».
    expect(SRC).toContain('{tv(lang, "Record made via")} {cert.partner} · {tv(lang, "verification by AEVION")}');
    // 20.10.2026 00:3x, замер Продаж на проде (390×844, ru-RU): английский дубль под русской
    // строкой был ВИДИМ (span 308×36 на 538px) — бюро читало обещание дважды на двух языках.
    // Дубль снят: одна строка на языке страницы (tv), английский — только при lang=en.
    expect(SRC, "английский дубль строки бренда вернулся").not.toContain("Record made via {cert.partner} · verification by AEVION</span>");
  });
  it("без партнёра — ничего: ветка null, не пустой div и не «undefined»", () => {
    const i = SRC.indexOf("{cert.partner ? (");
    const block = SRC.slice(i, i + 800);
    expect(block).toMatch(/\) : null\}/);
    expect(block).not.toContain("undefined");
  });
  it("строка партнёра стоит и в вердикте первого экрана (кадр 19.10: карточка была на y=1304/974)", () => {
    expect(SRC).toContain('data-testid="cert-partner-banner"');
    const banner = SRC.indexOf('data-testid="cert-partner-banner"');
    const verified = SRC.indexOf('{tv(lang, "Verified at")} {new Date(data.verifiedAt)');
    expect(verified).toBeGreaterThan(0);
    expect(banner - verified, "строка партнёра ушла из вердикта").toBeGreaterThan(0);
    expect(banner - verified).toBeLessThan(900);
    expect(SRC.slice(banner - 80, banner), "вердикт рисует строку без условия partner").toContain("{cert.partner ? (");
  });
  it("строка стоит в шапке карточки сразу под названием записи", () => {
    const title = SRC.indexOf("{cert.title}</div>");
    const partner = SRC.indexOf('data-testid="cert-partner"');
    expect(title).toBeGreaterThan(0);
    expect(partner).toBeGreaterThan(title);
    expect(partner - title, "строка партнёра ушла далеко от названия").toBeLessThan(600);
  });
});

// Продажи 21:0x: бюро в пилоте регистрирует САМО через /qright — без поля в форме бренд работал бы
// только для записей, сделанных нами руками. Поле есть, уходит как partnerName, помнится в браузере.
describe("форма /qright даёт бюро вписать своё название (partnerName)", () => {
  const Q = readFileSync(join(__dirname, "..", "..", "qright", "page.tsx"), "utf8");
  it("поле есть, ограничено 80 знаками и уходит в /protect как partnerName", () => {
    expect(Q).toContain('data-testid="partner-name"');
    expect(Q).toContain("maxLength={80}");
    expect(Q).toContain("partnerName: partnerName.trim().slice(0, 80) || undefined,");
    expect(Q).toContain('localStorage.setItem("aevion_qright_partner_v1"');
    expect(Q).toContain('localStorage.getItem("aevion_qright_partner_v1")');
    // Продажи 21:4x: блок свёрнут, заголовок говорил только про автора; имя живого лида — не пример.
    expect(Q).toContain("bureau / organisation shown on the verification page");
    expect(Q, "в подсказке поля имя живого лида").not.toContain("e.g. Консалтинг WPK");
  });
});
