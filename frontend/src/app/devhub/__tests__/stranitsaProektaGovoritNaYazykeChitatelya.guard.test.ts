import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 СТРАНИЦА ПРОЕКТА DevHub ГОВОРИТ НА ЯЗЫКЕ ЧИТАТЕЛЯ.
 *
 * 12.10.2026, окно ИИ-блогера, английский режим: около 5 с виден русский
 * текст до перевода на лету; «Сгенерировать код (Ctrl+Enter)» вшит по-русски;
 * «Сохранение работает только пока открыто превью…» рядом с «Выкатить»
 * звучит как угроза потери. Английский ролик про DevHub не публиковался.
 *
 * Строки перенесены в словарь страницы GEN_UI (ru/en/kk), а подпись под
 * превью начинается с того, ЧТО ПРОИЗОЙДЁТ по нажатию, и только потом —
 * короткая оговорка про данные форм.
 */
const СТР = readFileSync(join(process.cwd(), "src/app/devhub/[id]/page.tsx"), "utf8");
const КЛЮЧИ = ["btnGenerate", "btnDeploy", "btnDeployVercel", "emptyEditor", "deployWhatHappens", "storageNote"] as const;

function блок(язык: string): string {
  const нач = СТР.indexOf("\n  " + язык + ": {", СТР.indexOf("const GEN_UI"));
  expect(нач, "блок языка не найден: " + язык).toBeGreaterThan(-1);
  return СТР.slice(нач, СТР.indexOf("\n  },", нач));
}

describe("словарь страницы проекта", () => {
  it("🔴 все шесть ключей есть на трёх языках — знаменатель 18 из 18", () => {
    let найдено = 0;
    for (const я of ["ru", "en", "kk"]) {
      const б = блок(я);
      for (const к of КЛЮЧИ) {
        expect(б, `${я}: нет ключа ${к}`).toContain(к + ": \"");
        найдено++;
      }
    }
    expect(найдено).toBe(18);
  });

  it("🔴 английский блок — без кириллицы в этих ключах", () => {
    const б = блок("en");
    for (const к of КЛЮЧИ) {
      const m = б.match(new RegExp(к + ': "([^"]*)"'));
      expect(m, `en: ключ ${к}`).toBeTruthy();
      expect(m![1], `en.${к} содержит кириллицу: ${m![1]}`).not.toMatch(/[А-Яа-яЁё]/);
    }
  });

  it("🔴 вшитого русского в этих местах больше нет, страница зовёт словарь", () => {
    expect(СТР).not.toContain('GL.busyGen : "Сгенерировать код');
    expect(СТР).not.toContain('GL.busyDeploy : "Выкатить"');
    expect(СТР).not.toContain('GL.busyDeploy : "Выкатить на Vercel"');
    expect(СТР).not.toContain(">Выберите файл или попросите ИИ написать код<");
    expect(СТР).not.toContain("PODPIS_O_HRANILISHE");
    for (const к of КЛЮЧИ) expect(СТР, `страница не использует GL.${к}`).toContain("GL." + к);
  });

  it("🔴 подпись под превью: сначала что произойдёт по нажатию, потом оговорка", () => {
    expect(СТР).toContain("{GL.deployWhatHappens} {GL.storageNote}");
    // Объяснение говорит о публичном адресе — это и есть обещание кнопки.
    const ru = блок("ru").match(/deployWhatHappens: "([^"]*)"/)![1];
    expect(ru).toMatch(/публичн/);
    // Оговорка короче прежней (та была 103 знака и начиналась с «Сохранение работает только…»).
    const note = блок("ru").match(/storageNote: "([^"]*)"/)![1];
    expect(note.length).toBeLessThan(130);
    expect(note).not.toMatch(/^Сохранение работает только/);
  });
});
