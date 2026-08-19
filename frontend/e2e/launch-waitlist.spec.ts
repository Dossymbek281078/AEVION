import { test, expect } from "@playwright/test";

/**
 * Посадочные запуска — сбор адресов работает в настоящем браузере.
 *
 * Зачем именно E2E, когда есть 35 модульных тестов. Модульные проверяют
 * компонент, а здесь проверяется СВЯЗЬ: страница отдана сервером, гидратация
 * прошла, форма нашла обработчик, и запрос ушёл по правильному адресу с
 * правильной меткой источника. Если что-то из этого сломается, форма перестанет
 * отправлять МОЛЧА, и узнаем мы это по нулю подписок, а не по красному тесту.
 *
 * Замер 19.08.2026, из-за которого спек и написан: E2E-спеков двадцать, у DevHub
 * четыре, у мультичата НИ ОДНОГО, посадочные не покрыты вовсе.
 *
 * НИ ОДНОЙ ЗАПИСИ В БАЗУ. Запрос на подписку перехватывается (`page.route`) и
 * отвечает заглушкой — приём, уже принятый в devhub-snippet и planet-activity.
 * Поэтому спек безопасно гонять и против живого прода:
 *   PLAYWRIGHT_BASE_URL=https://aevion.app npx playwright test launch-waitlist
 *
 * ПОЧЕМУ ЭТОТ СПЕК НЕ ПОКРАСНЕЕТ В CI ПО ПРИЧИНАМ СРЕДЫ. Задача e2e.yml поднимает
 * только фронт, бэкенда там нет, и прокси на 127.0.0.1:4001 отдаёт ECONNREFUSED.
 * Проверил, чем это кончается для этих страниц: обе зовут `probeLive`, а он ловит
 * исключение и возвращает false (`catch { return false }`), то есть страница
 * рендерится, просто помечает возможности как ещё не живые. Поле адреса и кнопка
 * серверные и на месте. Значит бэкенд для этого спека не нужен — а тест, зелёный у
 * себя и красный в CI, был бы ровно тем дефектом, который я в этот день и разбирал.
 *
 * Чего здесь СОЗНАТЕЛЬНО нет: проверки, что на странице не обещана дата запуска.
 * Она живёт уровнем ниже (launchPages.render.test.tsx), потому что зависит от
 * версии кода, а этот спек может идти против прода, где выкатка отстаёт.
 */

const SUBSCRIBE = "**/api/constitution/waitlist/subscribe";

const PAGES = [
  { path: "/devhub/launch", mod: "devhub" },
  { path: "/multichat-engine/launch", mod: "multichat" },
] as const;

for (const { path, mod } of PAGES) {
  test.describe(`${path} — форма сбора адресов`, () => {
    test("страница открывается и показывает поле адреса", async ({ page }) => {
      await page.goto(path);
      const field = page.getByPlaceholder("вы@почта.рф");
      await expect(field).toBeVisible();
      await expect(page.getByRole("button", { name: /ранний доступ|Получить/i })).toBeVisible();
    });

    test("отправка уходит на ручку подписки с меткой этого модуля", async ({ page }) => {
      const sent: { email?: string; source?: string }[] = [];

      await page.route(SUBSCRIBE, async (route) => {
        const body = route.request().postDataJSON() as { email?: string; source?: string };
        sent.push(body);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, storage: "postgres" }),
        });
      });

      await page.goto(path);
      const email = `e2e-${mod}@primer.ru`;
      await page.getByPlaceholder("вы@почта.рф").fill(email);
      await page.getByRole("button", { name: /ранний доступ|Получить/i }).click();

      // Ждём именно ОТПРАВКУ, а не таймаут: если обработчик не подключился,
      // здесь и будет видно.
      await expect.poll(() => sent.length, { timeout: 15_000 }).toBe(1);

      expect(sent[0].email).toBe(email);
      // Метка обязана начинаться с имени модуля — по ней потом отбираются
      // получатели рассылки. Ошибись здесь, и человек попадёт не в тот список.
      expect(sent[0].source, "метка источника не от этого модуля").toMatch(
        new RegExp(`^${mod}(-|$)`),
      );
      expect((sent[0].source ?? "").length).toBeLessThanOrEqual(60);

      // Человек обязан увидеть подтверждение, а не молчание.
      await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });
    });

    test("канал из ?c= попадает в метку источника", async ({ page }) => {
      const sent: string[] = [];
      await page.route(SUBSCRIBE, async (route) => {
        sent.push((route.request().postDataJSON() as { source?: string }).source ?? "");
        await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      });

      await page.goto(`${path}?c=ig`);
      await page.getByPlaceholder("вы@почта.рф").fill(`e2e-ch-${mod}@primer.ru`);
      await page.getByRole("button", { name: /ранний доступ|Получить/i }).click();
      await expect.poll(() => sent.length, { timeout: 15_000 }).toBe(1);

      // Отрицательный контроль внутри теста: метка обязана ОТЛИЧАТЬСЯ от голого
      // имени модуля, иначе канал потерян и тест выше прошёл бы всё равно.
      expect(sent[0]).not.toBe(mod);
      expect(sent[0]).toMatch(new RegExp(`^${mod}-`));
    });
  });
}
