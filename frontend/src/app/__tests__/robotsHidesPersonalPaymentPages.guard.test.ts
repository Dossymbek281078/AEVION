import { describe, it, expect } from "vitest";
import { DISALLOWED_PATHS, robotsLine } from "@/app/robots";

/**
 * 🔴 Персональные страницы оплаты не должны попадать в поиск, а публичная
 * проверка сертификата — должна.
 *
 * ЗАМЕР 21.09.2026. Адрес /bureau/upgrade/<что угодно> отвечает 200 на ЛЮБУЮ
 * строку: выдуманный номер zzz-net-takogo дал страницу с «Cert:
 * zzz-net-takogo», шагами «Identity → Payment → Apply» и «Pay $19 for the
 * Verified-tier upgrade». Таких адресов бесконечно много — для поисковика это
 * неисчерпаемый мусор, и в индекс попадали бы номера сертификатов.
 *
 * Денег это не стоило: POST /api/bureau/payment/intent с тем же выдуманным
 * номером отвечает 404 «verification not found» (контроль: пустое тело — 400).
 * Закрыта именно ИНДЕКСАЦИЯ.
 *
 * Отрицательный контроль здесь важнее самого запрета: /verify/ закрывать
 * НЕЛЬЗЯ — это публичная проверка сертификата, её и ищут по ссылке. Запрет,
 * закрывший живую страницу, уже случался: правило `/qr` закрывало /qright,
 * /qreal и /qrenew, потому что путь в Disallow — это ПРЕФИКС.
 */
describe("robots: закрыто личное, открыто публичное", () => {
  it("прибор видит предмет: список запретов не пуст", () => {
    expect(DISALLOWED_PATHS.length).toBeGreaterThan(5);
  });

  it("персональная страница оплаты апгрейда закрыта", () => {
    expect(DISALLOWED_PATHS).toContain("/bureau/upgrade/");
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: публичная проверка сертификата НЕ закрыта", () => {
    // Сравнивать надо ИТОГОВЫЕ строки robots.txt, а не сырой список: часть
    // путей уходит в файл с якорем `$` (robotsLine), и он означает «только
    // этот адрес, без продолжений». Мой первый вариант читал сырой список и
    // объявил закрытым /qright — при том что в живом robots.txt стоит
    // `Disallow: /qr$`, то есть закрыт ровно короткий вход канала. Прибор
    // соврал, а не файл; проверено запросом живого robots.txt.
    const закрывает = (путь: string) =>
      DISALLOWED_PATHS.map(robotsLine).some((d) =>
        d.endsWith("$") ? путь === d.slice(0, -1) : путь.startsWith(d),
      );
    expect(закрывает("/verify/abc123")).toBe(false);
    expect(закрывает("/qright")).toBe(false);
    expect(закрывает("/bureau")).toBe(false);
  });

  it("ОТРИЦАТЕЛЬНЫЙ КОНТРОЛЬ: запрет не шире, чем нужно", () => {
    // «/bureau/upgrade/» не должен задевать саму /bureau и её другие разделы
    const закрывает = (путь: string) => DISALLOWED_PATHS.some((d) => путь.startsWith(d));
    expect(закрывает("/bureau/upgrade/xyz")).toBe(true);
    expect(закрывает("/bureau/notaries")).toBe(false);
  });
});
