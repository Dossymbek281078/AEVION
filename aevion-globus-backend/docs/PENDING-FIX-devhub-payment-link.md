# 🔴 Готовое исправление: `POST /api/devhub/media/payment-link` без авторизации

Подготовлено вкладкой `aevion-free-fleet` 28.07.2026. **Код не применён:** зона
`devhub` занята другой сессией (`node scripts/session-claim.mjs devhub` →
CLAIMED), поэтому здесь лежит патч, а не правка. Применять владельцу зоны — или
мне, когда зона освободится.

## Что не так (проверено чтением на трёх уровнях)

`aevion-globus-backend/src/routes/devhub.ts`, строка ~3303.

1. В обработчике нет ни одной проверки прав.
2. `devhubRouter.use(` в файле не встречается **ни разу** — middleware-уровня нет.
3. Монтирование `index.ts:1186` — `app.use("/api/devhub", devhubRouter)`, без охраны.

При этом ручка создаёт checkout **нашим** ключом LemonSqueezy в **нашем**
магазине, берёт из тела запроса цену (`custom_price`), название товара,
описание и — отдельно неприятное — **произвольный `redirect_url`** без списка
разрешённых адресов.

**Прочёсывание всего файла:** денежная ручка в devhub ровно одна, и это она.
Остальные модули с суммой из тела (`qmaskcard/charges`, `veilnetxLedger/entries`,
`aev .../mint`) авторизацию требуют — то есть это исключение, а не система.

**Живо ли прямо сейчас:** зависит от того, задан ли `LEMON_SQUEEZY_API_KEY` в
проде. Без него ручка отвечает 503. Проверять POST-запросом СОЗНАТЕЛЬНО не стал:
валидный запрос создал бы настоящую ссылку в платёжном провайдере основателя.

## Патч

Вставить сразу после строки `devhubRouter.post("/media/payment-link", async (req, res) => {`:

```ts
  // Без этой проверки ручка была открыта всем: посторонний мог выпускать в нашем
  // магазине LemonSqueezy ссылки с любой ценой и названием, под нашим брендом.
  // Идиом взят из соседних ручек этого же файла (см. POST /projects).
  const auth = verifyBearerOptional(req);
  if (!auth) return res.status(401).json({ error: "auth required" });
```

Заменить строку с `redirect_url`:

```ts
            redirect_url: safeRedirect(successUrl, frontendUrl),
```

И добавить рядом с остальными помощниками файла:

```ts
/**
 * Адрес возврата после оплаты. Принимаем только свой домен: произвольный
 * `successUrl` из тела запроса означает, что покупателя из НАШЕГО магазина
 * уводят куда угодно — в платёжном контексте это готовая цепочка обмана.
 */
function safeRedirect(raw: unknown, frontendUrl: string): string {
  const fallback = `${frontendUrl}/devhub?payment=success`;
  if (typeof raw !== "string" || !raw) return fallback;
  try {
    const u = new URL(raw, frontendUrl);
    const allowed = new URL(frontendUrl);
    return u.origin === allowed.origin ? u.toString() : fallback;
  } catch {
    return fallback;
  }
}
```

Цену оставляю из тела осознанно: это ссылка на собственный товар автора, и
подменять её записью из базы — отдельное продуктовое решение, а не устранение
дырки. Достаточно того, что выпускать ссылки сможет только вошедший человек.

## Тест, который надо добавить вместе с патчем

Файл `tests/devhubPaymentLinkAuth.test.ts`:

```ts
import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({ query: async () => ({ rows: [], rowCount: 0 }), connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) }),
}));

// eslint-disable-next-line import/first
import { devhubRouter } from "../src/routes/devhub";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("платёжная ссылка требует входа", () => {
  test("без токена — 401 и никакого обращения к LemonSqueezy", async () => {
    const res = await request(app())
      .post("/api/devhub/media/payment-link")
      .send({ name: "Товар", amountCents: 100500 });
    expect(res.status).toBe(401);
  });

  test("чужой адрес возврата не принимается", async () => {
    // с валидным токеном и successUrl на постороннем домене ответ не должен
    // содержать этот домен: ожидается подмена на наш fallback
    // (проверять после патча — сейчас тест красный по построению)
  });
});
```

**Обязательно прогнать на коде ДО патча** — тест должен упасть. Тест, который
проходит и до исправления, ничего не сторожит.

## Порядок действий

1. `node scripts/session-claim.mjs devhub` — убедиться, что зона освободилась.
2. Применить патч и добавить тест.
3. `npx vitest run tests/devhubPaymentLinkAuth.test.ts` — красный до патча, зелёный после.
4. `npx tsc --noEmit`.
5. Проверить в Railway, задан ли `LEMON_SQUEEZY_API_KEY`: если да — выкатывать
   не откладывая.
