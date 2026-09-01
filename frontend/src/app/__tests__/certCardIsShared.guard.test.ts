import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { anchorLine } from "../bureau/og/certCard";

/**
 * Картинку предпросмотра сертификата показывают ДВА маршрута — страница
 * сертификата и страница проверки (адрес из QR-кода). Отрисовка обязана быть
 * одна: вторая копия разойдётся с первой при первой же правке текста, а
 * расхождение в том, что показывают посторонним, — тот самый класс, ради
 * которого всё это делалось.
 */

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES = [
  "bureau/cert/[certId]/opengraph-image.tsx",
  "verify/[id]/opengraph-image.tsx",
];

describe("карточка сертификата рисуется одним модулем на оба маршрута", () => {
  for (const r of ROUTES) {
    test(`${r} зовёт общий модуль, а не свою копию`, () => {
      const src = readFileSync(join(APP, r), "utf8");
      expect(src, "маршрут не использует общую отрисовку").toContain("renderCertCard");
      // Признак копии: собственный ImageResponse внутри маршрута.
      expect(src, "в маршруте своя отрисовка — появится вторая версия карточки").not.toContain("new ImageResponse");
    });
  }

  test("строка про якорь обещает только подтверждённое", () => {
    expect(anchorLine({ status: "bitcoin-confirmed", bitcoinBlockHeight: 912345 })).toContain("912345");
    expect(anchorLine({ status: "pending", bitcoinBlockHeight: null })).toMatch(/in progress/i);
    // Не якорено — про биткойн НИ СЛОВА: у пяти записей из семи его нет.
    expect(anchorLine({ status: "not_stamped", bitcoinBlockHeight: null })).not.toMatch(/Bitcoin/i);
    expect(anchorLine(null)).not.toMatch(/Bitcoin/i);
  });

  test("подтверждено без высоты — номер блока не выдумывается", () => {
    const s = anchorLine({ status: "bitcoin-confirmed", bitcoinBlockHeight: null });
    expect(s).toMatch(/Anchored in Bitcoin/);
    expect(s).not.toMatch(/[0-9]/);
  });
});
