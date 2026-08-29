import { describe, it, expect } from "vitest";
import { buildJustificationFile, justificationFileName } from "./justificationFile";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Файл, который человек уносит, объясняет сам себя.
 *
 * ПОВОД (29.08.2026). Страница брала из ответа document, attestation и scope,
 * а `verifyYourself` — рецепт проверки — ВЫБРАСЫВАЛА. Файл уходил к регулятору
 * или партнёру с подписью и без единого слова о том, что с ней делать.
 *
 * Та же ночная тема, что и с якорем: доказательство путешествует отдельно от
 * способа его проверить и потому не работает.
 */
describe("скачиваемое обоснование несёт рецепт проверки", () => {
  const doc = { city: "nyc", from: 0, to: 3 };
  const att = { alg: "Ed25519", contentHash: "ab", signature: "cd", publicKey: "ef" };
  const recipe = { steps: ["1. …", "2. …"], stepsEn: ["1. …", "2. …"] };

  it("рецепт попадает в файл, когда он пришёл", () => {
    const out = JSON.parse(buildJustificationFile({
      document: doc, attestation: att, scope: "область", verifyYourself: recipe,
    }));
    expect(out.verifyYourself, "рецепт потерян по дороге в файл").toEqual(recipe);
    expect(out.document).toEqual(doc);
    expect(out.attestation).toEqual(att);
    expect(out.scope).toBe("область");
  });

  it("оговорка о применимости едет в ОБЕИХ половинах", () => {
    // Файл уходит один, читатель может быть любой. Оговорка о применимости —
    // как раз то, что регулятор читает первым; отдать её только по-русски
    // значит отдать непонятный документ половине читателей.
    const out = JSON.parse(buildJustificationFile({
      document: doc, attestation: att, scope: "область", scopeEn: "scope",
    }));
    expect(out.scope).toBe("область");
    expect(out.scopeEn, "английская половина оговорки потеряна").toBe("scope");
  });

  it("отсутствующая половина не подменяется русской", () => {
    // Положить сюда `scope` вместо `scopeEn` значило бы выдать русский текст
    // за английский — читатель решит, что перевод есть, и не станет искать.
    const out = JSON.parse(buildJustificationFile({
      document: doc, attestation: att, scope: "область",
    }));
    expect("scopeEn" in out).toBe(false);
  });

  it("рецепт НЕ выдумывается, когда его не прислали", () => {
    // Положить сюда «шаги по умолчанию» значило бы повторить ошибку в другую
    // сторону: файл обещал бы проверку, которую служба не подтверждала.
    const out = JSON.parse(buildJustificationFile({ document: doc, attestation: att }));
    expect("verifyYourself" in out).toBe(false);
    expect("scope" in out).toBe(false);
  });

  it("файл — читаемый JSON с отступами, а не одна строка", () => {
    const s = buildJustificationFile({ document: doc, attestation: att });
    expect(s.includes(String.fromCharCode(10))).toBe(true);
  });

  it("имя файла называет город и пару площадок", () => {
    expect(justificationFileName(doc)).toBe("qskyway-justification-nyc-0-3.json");
  });

  it("имя файла не падает на пустом документе", () => {
    // Скачивание не должно ломаться из-за формы ответа: пусть имя будет
    // невнятным, но файл сохранится.
    expect(justificationFileName(null)).toContain("qskyway-justification-");
    expect(justificationFileName({})).toContain("city");
  });
});

/**
 * Имя поля с рецептом — то же по обе стороны HTTP.
 *
 * Нетипизированная строка через границу: бэкенд кладёт `verifyYourself`,
 * страница читает `j.verifyYourself`. Переименуют на бэкенде — страница молча
 * перестанет класть рецепт в файл, и никто не заметит: файл по-прежнему
 * скачивается, просто становится непроверяемым.
 */
describe("поле рецепта называется одинаково у страницы и у службы", () => {
  const BACKEND = path.join(
    __dirname, "..", "..", "..", "..", "aevion-globus-backend", "src", "routes", "qskyway.ts",
  );

  it("файл бэкенда на месте — иначе связь надо переписать, а не удалять", () => {
    expect(existsSync(BACKEND), "не нашёл " + BACKEND).toBe(true);
  });

  it("страница читает поле, которое бэкенд действительно отдаёт", () => {
    const page = readFileSync(path.join(__dirname, "_client.tsx"), "utf8");
    expect(page.includes("j.verifyYourself"), "страница больше не читает рецепт").toBe(true);
    const backend = readFileSync(BACKEND, "utf8");
    expect(
      backend.includes("verifyYourself:"),
      "бэкенд не отдаёт поле verifyYourself — страница ждёт то, чего нет",
    ).toBe(true);
  });
});
