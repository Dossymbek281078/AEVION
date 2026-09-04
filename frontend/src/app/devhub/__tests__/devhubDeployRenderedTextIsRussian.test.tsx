import { describe, test, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Suspense } from "react";
import {
  sobratVidimyj,
  angliyskieStroki,
  tolkoLatinica,
  ostalosLatinskoeSlovo,
  TERMINY_OBSHIE,
} from "@/test-utils/renderedText";

/**
 * Экран выкатки DevHub говорит по-русски — проверка по ОТРИСОВКЕ.
 *
 * Этот экран платящий смотрит в самый напряжённый момент: он только что нажал
 * «опубликовать» и ждёт. Здесь английская подпись стоит дороже, чем на
 * витрине, — человек читает её, пытаясь понять, что происходит.
 *
 * ПОЧЕМУ ОТРИСОВКА, А НЕ ИСХОДНИК. За три дня исходниковый сторож соседнего
 * модуля четырежды получал новую форму записи подписи и каждый раз оставался
 * зелёным при живом английском. Перечисление форм не сходится; вопрос «что
 * видит человек» — сходится.
 *
 * ГРАНИЦА: отрисовка показывает НАЧАЛЬНОЕ состояние, до ответа сервера.
 * Подписи состояний выкатки (Ожидает / Собирается / Работает / Не удалось)
 * появляются позже и проверяются исходниковым сторожем workspaceTextIsRussian.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/devhub/x/deploy",
}));
vi.mock("@/lib/apiBase", () => ({ apiUrl: (p: string) => p }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));

import DevHubDeployPage from "../[id]/deploy/page";

/** Термины сверх общего списка — имена сервисов выкатки. */
/**
 * Термины сверх общего списка: имена сервисов и ИДЕНТИФИКАТОРЫ стеков.
 * `static` приходит из данных проекта — это машинное значение, которое
 * человек видит как есть; переводить его нельзя, оно уходит обратно на сервер.
 */
const TERMINY = [...TERMINY_OBSHIE, "DevHub", "Pages", "Deploy", "pages.dev", "static", "express", "react"];

describe("экран выкатки DevHub говорит по-русски (по отрисовке)", () => {
  test("КОНТРОЛЬ: правило отличает английское от русского", () => {
    // Без этой пары мутация «правило всегда false» проходит: сторож перестаёт
    // находить что-либо, а контроли охвата остаются зелёными.
    expect(tolkoLatinica("Building"), "английское не распознано").toBe(true);
    expect(tolkoLatinica("Собирается"), "русское принято за английское").toBe(false);
    expect(ostalosLatinskoeSlovo("DevHub Pages", TERMINY), "термины не отсеиваются").toBe(false);
    expect(ostalosLatinskoeSlovo("Deployment failed", TERMINY), "отсев съедает настоящее").toBe(true);
  });

  test("видимый текст и подписи — не английские", async () => {
    // Отвечаем НАСТОЯЩЕЙ формой данных, иначе страница застревает на экране
    // ожидания и сторож проверяет одно слово вместо рабочего экрана. Пустой
    // ответ здесь дал бы зелёный цвет при непроверенной странице.
    vi.stubGlobal("fetch", vi.fn(async (u: string) => {
      if (String(u).includes("/deployments")) {
        return new Response(JSON.stringify({ deployments: [{
          id: "d1", status: "live", deployUrl: "https://proba.pages.dev",
          buildLog: null, triggeredAt: new Date(0).toISOString(), completedAt: new Date(0).toISOString(),
        }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ project: {
        id: "proba", name: "Проба", stack: "static", status: "live",
        deployUrl: "https://proba.pages.dev",
      } }), { status: 200 });
    }));
    // Страница читает params через use() — на неразрешённом промисе она
    // приостанавливается. Без Suspense и без прогона микрозадач отрисовки не
    // случится вовсе, и сторож был бы зелёным на пустоте.
    // Страница читает params через use() — на неразрешённом промисе она
    // приостанавливается. Отрисовка обязана идти ВНУТРИ await act, иначе
    // приостановка случается вне области act, React об этом предупреждает, а
    // сторож остаётся зелёным на пустой разметке.
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <Suspense fallback={null}>
          <DevHubDeployPage params={Promise.resolve({ id: "proba" })} />
        </Suspense>,
      ).container;
    });
    // Второй прогон микрозадач: первый разрешает params, данные приходят позже.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const v = sobratVidimyj(container);

    // Охват СБОРА ТЕКСТА: пустая страница прошла бы любую проверку.
    expect(v.tekst.length, "видимого текста нет — страница не отрисовалась").toBeGreaterThan(3);
    // Порога по атрибутам здесь НЕТ намеренно: на этом экране их ноль, и это
    // законно — у кнопок есть видимый текст, отдельная подпись им не нужна.
    // Требовать их значило бы завести вечно красную проверку.
    //
    // Сам сбор атрибутов проверяется ОДИН раз, там где живёт помощник:
    // src/test-utils/renderedText.test.ts. Размножать этот контроль по
    // страницам нельзя — размноженный контроль расходится.
    // И контроль в обратную сторону: русский текст ЕСТЬ, то есть смотрим на
    // русскую страницу, а не на пустую разметку.
    expect(
      v.vsyo.filter((s) => /[А-ЯЁа-яё]/.test(s)).length,
      "русского текста нет вовсе — проверка бессмысленна",
    ).toBeGreaterThan(2);

    expect(
      angliyskieStroki(v, TERMINY),
      "английский текст на экране выкатки: человек читает его, пытаясь понять, что происходит",
    ).toEqual([]);
  });
});
