// Наши пробы не получают письмо запуска. Замер 28.09.2026: проверка приёма адреса записала
// probe-chess-28sep@aevion.app с меткой cyberchess-app-probe, и отбор признал её подписчиком —
// метка начинается с «cyberchess-». Домен aevion.app без MX: письмо отбилось бы, счёт соврал.
import { describe, expect, test } from "vitest";
import { isOwnProbe, planLaunchAnnounce } from "../src/lib/launchAnnounce";

describe("рассылка запуска не пишет нашим пробам", () => {
  test("признаки пробы: служебный домен, маркер в адресе или в метке", () => {
    expect(isOwnProbe("probe-chess-28sep@aevion.app", "cyberchess-app-probe")).toBe(true);
    expect(isOwnProbe("smoke@mail.ru", "cyberchess")).toBe(true);
    expect(isOwnProbe("someone@mail.ru", "cyberchess-smoke")).toBe(true);
    expect(isOwnProbe("e2e.runner@gmail.com", "cyberchess")).toBe(true);
    expect(isOwnProbe("", "cyberchess")).toBe(true);
  });
  test("контроль: живые адреса и метки проходят", () => {
    expect(isOwnProbe("anna@gmail.com", "cyberchess")).toBe(false);
    expect(isOwnProbe("tester@yandex.ru", "cyberchess-ig")).toBe(false); // «tester» — не маркер
    expect(isOwnProbe("probert@mail.ru", "cyberchess")).toBe(false); // маркер только отдельным куском
    expect(isOwnProbe("ivan@aevion.tech", "cyberchess")).toBe(false); // другой наш домен, с почтой
  });
  test("отбор получателей выбрасывает пробу и оставляет человека", () => {
    const plan = planLaunchAnnounce("cyberchess", [
      { email: "probe-chess-28sep@aevion.app", source: "cyberchess-app-probe" },
      { email: "anna@gmail.com", source: "cyberchess-app" },
      { email: "oleg@mail.ru", source: "cyberchess" },
    ]);
    expect(plan.recipients).toEqual(["anna@gmail.com", "oleg@mail.ru"]);
    expect(plan.scanned).toBe(3); // просмотрено три, письмо двоим — разница видна в отчёте
  });
});
