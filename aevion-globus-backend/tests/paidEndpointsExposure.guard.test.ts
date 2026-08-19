import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Ручки, обращающиеся к ПЛАТНОМУ провайдеру, не должны быть доступны без всякой
// защиты. Замер 19.08.2026 на живом проде: POST /api/devhub/media/email, /media/sms,
// /media/whatsapp и /media/email-template-create отвечают анонимному запросу 400
// (сообщение о валидации), а не 401 — то есть проверки доступа нет вовсе. Контроль:
// /api/qright/objects?mine=1 и /api/auth/me честно отдают 401, значит измерение
// видит отказы авторизации.
//
// Последствие не в утечке: это чужие письма и SMS с нашего адреса, за наши деньги,
// и в пределе блокировка отправителя, на репутации которого стоит рассылка на запуск.
//
// ПОЧЕМУ ЭТО РАТЧЕТ, А НЕ ЗАПРЕТ. Закрыть их сейчас нельзя одной правкой: фронт
// зовёт эти же ручки без токена, и на странице DevHub все 27 вызовов анонимны —
// модуль неавторизован целиком. Форма починки зависит от решения основателя
// («DevHub — продукт или внутренний инструмент»), а сторож, красный при исправной
// системе, приучает не смотреть на красное.
//
// Поэтому здесь порог: долг зафиксирован и НЕ РАСТЁТ. Стало лучше — опустите число,
// тест за улучшение не наказывает.

// Порог 17 → 15 вечером 19.08.2026, и вот честная картина, потому что число здесь
// меньше говорит, чем кажется.
//
// Что изменилось: предел частоты появился у `/ask` (зовёт платное дополнение с
// входом до 16 000 знаков) и у `/media/upload-image` (грузит в Cloudflare Images).
// Обе были анонимны и без предела; коммит d9cc19ce0 от 28.07 их пропустил.
//
// 🔴 Чего этот прибор НЕ видит. Отправляющие ручки — письма, SMS, WhatsApp,
// отправка шаблона — прикрыты предельщиком, объявленным СПИСКОМ через
// `devhubRouter.use([...])`, а сторож считает пометки у самих маршрутов. То есть
// по этому счётчику они по-прежнему «без защиты», а на самом деле упираются в
// предел. Проверяется это поведением, в `tests/devhubSendingRateLimited.test.ts`
// (настоящие запросы до 429, три мутации ловятся, включая контроль «предел не
// задел читающие ручки»).
//
// Почему списком, а не построчно: d9cc19ce0 ставит предел ровно этим ручкам
// построчно и ждёт мержа 22 дня. Правка в те же строки дала бы конфликт на его
// патче. Когда он придёт, оба предела сложатся — это безвредно, сработает строгий,
// и тогда порог здесь опустится до 6 (замерено на probe/limiter-onto-merged).
const BASELINE_UNPROTECTED = 15;

const PAID = /process\.env\.(BREVO_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|OPENROUTER_API_KEY|REPLICATE_API_TOKEN|HIGGSFIELD[A-Z_]*|CLOUDFLARE[A-Z_]*)/;
const GUARD = /generationLimit|rateLimit|Limit\(|requireAuth|verifyBearer|adminToken|AEVION_ADMIN_TOKEN/;
const ROUTE = /devhubRouter\.(get|post|put|patch|delete)\(\s*"([^"]+)"(.*)$/;

interface Route { method: string; path: string; paid: boolean; guarded: boolean }

function routes(): Route[] {
  const lines = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8").split(/\r?\n/);
  const heads: { i: number; method: string; path: string; head: string }[] = [];
  lines.forEach((l, i) => {
    const m = ROUTE.exec(l);
    if (m) heads.push({ i, method: m[1].toUpperCase(), path: m[2], head: m[3] });
  });
  return heads.map((h, k) => {
    const body = lines.slice(h.i, k + 1 < heads.length ? heads[k + 1].i : lines.length).join("\n");
    return { method: h.method, path: h.path, paid: PAID.test(body), guarded: GUARD.test(h.head + body) };
  });
}

describe("платные ручки DevHub: долг зафиксирован и не растёт", () => {
  const all = routes();
  const paid = all.filter((r) => r.paid);
  const unprotected = paid.filter((r) => !r.guarded);

  test("прибор нашёл маршруты и умеет отличать платные", () => {
    // Отрицательный контроль на оба конца: без него «ноль незащищённых» могло бы
    // означать «маршрутов не найдено» или «шаблон платного не срабатывает».
    expect(all.length).toBeGreaterThan(50);
    expect(paid.length).toBeGreaterThan(0);
    expect(paid.some((r) => r.path === "/media/email-templates")).toBe(true);
    // И обратный конец: не всё подряд считается платным.
    expect(paid.length).toBeLessThan(all.length);
  });

  test(`незащищённых платных ручек не больше ${BASELINE_UNPROTECTED}`, () => {
    const names = unprotected.map((r) => `${r.method} ${r.path}`).sort();
    expect(
      names.length,
      `стало больше, чем при замере 19.08.2026. Новые ручки, обращающиеся к платному провайдеру, обязаны получать generationLimit или проверку доступа.\n${names.join("\n")}`,
    ).toBeLessThanOrEqual(BASELINE_UNPROTECTED);
  });

  test("отправляющие ручки перечислены явно — чтобы правка не прошла незаметно", () => {
    // Именно они опаснее остальных: это действия наружу за наши деньги. Если такая
    // ручка исчезнет или закроется, тест обязан заставить обновить список осознанно.
    const sending = ["/media/email", "/media/sms", "/media/whatsapp", "/media/email-template-send"];
    const present = sending.filter((p) => all.some((r) => r.path === p && r.method === "POST"));
    expect(present.sort()).toEqual([...sending].sort());
  });
});
