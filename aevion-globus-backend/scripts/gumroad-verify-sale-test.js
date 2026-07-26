/**
 * Проверка verifyGumroadSale() — защиты вебхука от поддельных пингов.
 *
 * Запуск (сначала собрать: npx tsc):
 *   node scripts/gumroad-verify-sale-test.js
 *
 * Тест гоняет СОБРАННЫЙ код из dist/, а не исходник, — чтобы проверялось ровно
 * то, что уезжает на прод.
 *
 * ЧЕГО ЭТОТ ТЕСТ НЕ ДОКАЗЫВАЕТ: контракт живого Gumroad API здесь подменён
 * заглушкой (токен лежит в Railway, локально его нет). Тест фиксирует политику
 * отказа — «отклоняем только при определённом "продажи нет", при любой
 * неопределённости пропускаем», — но не то, что Gumroad действительно отвечает
 * 404/success:false на несуществующий id. Это проверяется на проде.
 */

const { verifyGumroadSale } = require("../dist/lib/payment/gumroadProvider.js");

let pass = 0;
let fail = 0;

async function check(name, setup, expected) {
  const restore = global.fetch;
  setup();
  let got;
  try {
    got = await verifyGumroadSale("sale_123");
  } finally {
    global.fetch = restore;
  }
  const ok = got === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ожидалось ${expected}, получено ${got}`);
}

(async () => {
  process.env.GUMROAD_ACCESS_TOKEN = "tok_test";

  await check(
    "реальная продажа (200, success:true)",
    () => {
      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, sale: { id: "sale_123" } }),
      });
    },
    "confirmed",
  );

  await check(
    "поддельный id (404)",
    () => {
      global.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    },
    "not_found",
  );

  await check(
    "поддельный id (200 + success:false)",
    () => {
      global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ success: false }) });
    },
    "not_found",
  );

  await check(
    "API лежит (503) — не отклоняем",
    () => {
      global.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    },
    "unverifiable",
  );

  await check(
    "сеть упала — не отклоняем",
    () => {
      global.fetch = async () => {
        throw new Error("ECONNRESET");
      };
    },
    "unverifiable",
  );

  delete process.env.GUMROAD_ACCESS_TOKEN;
  await check(
    "нет токена — в сеть не ходим и не отклоняем",
    () => {
      global.fetch = async () => {
        throw new Error("fetch не должен был вызываться без токена");
      };
    },
    "unverifiable",
  );

  console.log(`\ngumroad-verify-sale: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})();
