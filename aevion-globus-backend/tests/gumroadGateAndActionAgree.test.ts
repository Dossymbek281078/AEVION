/**
 * Ворота и действие спрашивают ОДНО И ТО ЖЕ имя переменной.
 *
 * Маршрут Конституции решает, можно ли вести человека в Gumroad, по переменной
 * `GUMROAD_CONSTITUTION_PRO_PERMALINK` — она задана на проде (проверено 02.09
 * запросом ИМЁН у сервиса, без значений). Дальше он передаёт провайдеру ссылку
 * `constitution-pro`, а провайдер искал `GUMROAD_PERMALINK_CONSTITUTION_PRO` —
 * другую переменную, не заданную нигде.
 *
 * Ворота говорили «пермалинк есть», действие его не находило и собирало адрес
 * из самой ссылки: `gumroad.com/l/constitution-pro`, товар, которого может не
 * существовать. Класс общий с находкой соседнего окна про наборы: просим товар
 * X — касса выдаёт Y или ничего, и оба исхода видны только на оплате.
 *
 * Сегодня дефект СКРЫТ: ключ LemonSqueezy задан, и до ветки Gumroad дело не
 * доходит. То есть проявился бы он ровно в тот момент, когда откажет первый
 * провайдер, — когда запасной путь и нужен. Такие поломки не находят себя сами.
 */
import { describe, it, expect, afterEach } from "vitest";
import { gumroadPaymentProvider } from "../src/lib/payment/gumroadProvider";

const СОХРАНЁННЫЕ = { ...process.env };
afterEach(() => {
  process.env = { ...СОХРАНЁННЫЕ };
});

async function адресКассы(reference: string): Promise<string> {
  const intent = await gumroadPaymentProvider.createIntent({
    reference,
    amountCents: 4900,
    currency: "USD",
    description: "проверка",
    email: "a@b.co",
  });
  return intent.checkoutUrl;
}

describe("пермалинк Gumroad", () => {
  it("читается по имени, которым пользуются ворота маршрута", async () => {
    delete process.env.GUMROAD_PERMALINK_CONSTITUTION_PRO;
    delete process.env.GUMROAD_DEFAULT_PERMALINK;
    process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK = "konst-pro";

    const адрес = await адресКассы("constitution-pro");
    expect(адрес, "имя ворот не читается — покупатель уедет не туда").toContain("konst-pro");
  });

  it("прежнее имя продолжает работать", async () => {
    // Вторая запись не заменяет первую: по ней настроены другие товары
    // (GUMROAD_PERMALINK_TIER_FULL_MONTHLY и соседние), и потерять их нельзя.
    delete process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK;
    delete process.env.GUMROAD_DEFAULT_PERMALINK;
    process.env.GUMROAD_PERMALINK_CONSTITUTION_PRO = "staroe-imya";

    const адрес = await адресКассы("constitution-pro");
    expect(адрес, "прежнее имя перестало читаться").toContain("staroe-imya");
  });

  it("пустое значение не считается настройкой", async () => {
    /*
     * Переменная, заданная пустой строкой, — не «настроено». Такое на проде уже
     * встречалось (ключи Stripe заданы и пусты), и прежняя запись через `??`
     * приняла бы пустую строку за значение: адрес кассы собрался бы из пустого
     * пермалинка, то есть вёл бы в никуда.
     */
    process.env.GUMROAD_PERMALINK_CONSTITUTION_PRO = "";
    process.env.GUMROAD_CONSTITUTION_PRO_PERMALINK = "  ";
    process.env.GUMROAD_DEFAULT_PERMALINK = "zapas";

    const адрес = await адресКассы("constitution-pro");
    expect(адрес, "пустая переменная принята за настройку").toContain("zapas");
  });
});
