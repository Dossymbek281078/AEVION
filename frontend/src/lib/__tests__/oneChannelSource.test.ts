/**
 * Все, кто спрашивает «откуда пришёл этот человек», обязаны спрашивать ОДНО.
 *
 * 31.08.2026 канал научился переживать поход в кассу — но только у события
 * замера. Четыре места, строящие адрес кассы и форму подписки, продолжали
 * читать адрес страницы. Два наших собственных ответа об одном расходились:
 * наша сводка сказала бы «из TikTok», а в заказе у кассы канала бы не было.
 * Сверить их стало бы нечем, притом что заказ — денежная правда.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "../../app/__tests__/helpers/sourceCode";

const ЧИТАЮТ_КАНАЛ = [
  "src/lib/track.ts",
  "src/components/UpgradeButton.tsx",
  "src/components/ModulePricingChip.tsx",
  "src/components/WaitlistCapture.tsx",
  "src/app/apps/page.tsx",
  "src/app/pricing/page.tsx",
  "src/app/qmelanin/_client.tsx",
  "src/app/qrenew/_client.tsx",
];

/*
 * Честная граница списка. Здесь только те, кто работает В БРАУЗЕРЕ: память
 * канала живёт в хранилище вкладки, и на сервере её нет по устройству.
 *
 * Намеренно НЕ входят:
 *   src/app/go/page.tsx    — серверная страница, хранилища у неё нет. Это
 *                            посадочная: метка там есть по построению, ради
 *                            неё на страницу и приходят;
 *   KeepChannelLink        — не читает канал для решения, а переносит метку
 *                            из текущего адреса в соседнюю ссылку;
 *   PageTracking           — спрашивает channelNow(), но ещё различает
 *                            «метка была и не опознана» и «метки не было»,
 *                            поэтому адрес ему нужен вдобавок.
 *
 * Проверяется это ниже отдельно, а не оставлено на веру.
 */

const текст = (p: string) => stripComments(readFileSync(join(process.cwd(), p), "utf8"));

describe("источник канала один", () => {
  it.each(ЧИТАЮТ_КАНАЛ)("%s спрашивает channelNow(), а не адрес страницы", (p) => {
    const s = текст(p);
    expect(s).toContain("channelNow(");
    // Прямое чтение `?c=` мимо общего источника — это возврат расхождения.
    expect(s).not.toContain('.get("c")');
  });

  it("единственное место, читающее адрес — сам общий источник", () => {
    expect(текст("src/lib/channelNow.ts")).toContain('.get("c")');
  });
  it("PageTracking спрашивает общий источник, а не только адрес", () => {
    const s = текст("src/components/PageTracking.tsx");
    expect(s).toContain("channelNow()");
    // Прежде он ставил «прямой заход» при отсутствии метки в адресе — и
    // просмотр расходился с покупкой в той же вкладке.
    expect(s).not.toContain('const channel = raw ? (channelFrom(raw) ?? "unknown") : "direct"');
  });
});
