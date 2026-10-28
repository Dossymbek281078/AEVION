/**
 * 28.10.2026 (окно «Продукт», находка Науки). Браузер → aevion.app (Vercel) → api.aevion.app
 * (Railway) → Express. За Railway clientIp брал X-Real-IP — но при заходе через прокси сайта
 * это выход Vercel: 305 событий /api/pricing/events за час с 3–4 адресов, и тот же адрес
 * был ключом лимитов и квот (лимит общий на всех). Прокси сайта кладёт настоящий адрес в
 * x-aevion-client-ip и подписывает AEVION_EDGE_KEY (frontend/src/lib/guestIpProxy.ts).
 * Правило: верный ключ → адрес гостя; нет ключа или чужой → как раньше (X-Real-IP).
 * Мутация 28.10: убрать вызов адресОтПроксиСайта из clientIp → тесты 1 и 3 красные (проверено).
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { clientIp } from "../src/lib/rateLimit";

const СЕКРЕТ = "edge-key-0123456789abcdef";
const VERCEL = "76.76.21.21";
const ГОСТЬ = "147.30.21.19";
const черезСайт = (ключ: string | undefined, адрес: string | undefined = ГОСТЬ) => ({
  ip: "100.64.3.7",
  socket: { remoteAddress: "100.64.3.7" },
  headers: {
    "x-real-ip": VERCEL,
    ...(ключ !== undefined ? { "x-aevion-edge-key": ключ } : {}),
    ...(адрес !== undefined ? { "x-aevion-client-ip": адрес } : {}),
  },
});

describe("ключ ограничителя за прокси сайта (Vercel)", () => {
  let прежний: string | undefined;
  beforeAll(() => { прежний = process.env.AEVION_EDGE_KEY; process.env.AEVION_EDGE_KEY = СЕКРЕТ; });
  afterAll(() => { if (прежний === undefined) delete process.env.AEVION_EDGE_KEY; else process.env.AEVION_EDGE_KEY = прежний; });

  test("🔴 верный ключ — адрес гостя, а не выход Vercel", () => {
    expect(clientIp(черезСайт(СЕКРЕТ))).toBe(ГОСТЬ);
  });
  test("чужой ключ — заголовку не верим, остаётся X-Real-IP (как раньше)", () => {
    expect(clientIp(черезСайт("wrong-key-0123456789abcdef"))).toBe(VERCEL);
  });
  test("🔴 два гостя через один выход Vercel — разные ключи", () => {
    const a = clientIp(черезСайт(СЕКРЕТ, "1.1.1.1"));
    const b = clientIp(черезСайт(СЕКРЕТ, "2.2.2.2"));
    expect(a).not.toBe(b);
    expect(a).toBe("1.1.1.1");
  });
  test("ключ есть, адрес мусор — не принимается", () => {
    expect(clientIp(черезСайт(СЕКРЕТ, "не адрес"))).toBe(VERCEL);
  });
  test("без ключа — прежнее поведение за Railway", () => {
    expect(clientIp(черезСайт(undefined))).toBe(VERCEL);
  });
  test("секрет не настроен — заголовок не принимается даже с «верным» ключом", () => {
    delete process.env.AEVION_EDGE_KEY;
    try { expect(clientIp(черезСайт(СЕКРЕТ))).toBe(VERCEL); } finally { process.env.AEVION_EDGE_KEY = СЕКРЕТ; }
  });
});
