import { describe, test, expect } from "vitest";
import { capabilityHint, indexCapabilities, isCapabilityBlocked } from "../devhubCapabilities";

/**
 * Подсказка о недоступной возможности живёт в ТОСТЕ, а тост — слепая зона
 * машинного доводчика по устройству: он не успевает за текстом, который
 * держится секунды. До 08.09.2026 подпись и объяснение были зашиты по-русски в
 * пятнадцати вызовах, то есть EN-посетитель, нажавший недоступную кнопку,
 * читал русскую фразу. На проде это не редкость: в день правки degraded были
 * перевод, github и озвучка, not_available — railway и домен.
 */
const caps = indexCapabilities([
  { id: "video", status: "live" },
  { id: "vercel", status: "needs_token" },
  { id: "translate", status: "degraded" },
  { id: "нечто", status: "not_available", name: "Имя от сервера" },
]);

describe("подсказка говорит на языке читателя", () => {
  test("русский — подпись и объяснение по-русски", () => {
    const h = capabilityHint(caps, "vercel", "ru");
    expect(h).toContain("Выкатка на Vercel");
    expect(h).toContain("не подключён");
  });

  test("английский — НИ ОДНОЙ кириллической буквы", () => {
    const h = capabilityHint(caps, "vercel", "en");
    expect(/[а-яё]/i.test(h), `в английской подсказке кириллица: ${h}`).toBe(false);
    expect(h).toContain("Vercel deploy");
    // Замена тоже переводится: без неё человек узнаёт, что нельзя, и не узнаёт
    // что можно.
    expect(h).toContain("Cloudflare Pages");
  });

  test("казахский — своя подпись, не английская и не русская", () => {
    const h = capabilityHint(caps, "video", "kk");
    expect(h).toBe("Бейне генерациясы");
  });

  test("живая возможность — только подпись, без объяснения отказа", () => {
    expect(capabilityHint(caps, "video", "ru")).toBe("Генерация видео");
  });

  test("незнакомый язык падает на английский, а не на пустоту", () => {
    const h = capabilityHint(caps, "vercel", "de");
    expect(h).toContain("Vercel deploy");
    expect(h.length).toBeGreaterThan(10);
  });

  test("незнакомый идентификатор берёт имя от сервера, а не молчит", () => {
    expect(capabilityHint(caps, "нечто", "en")).toContain("Имя от сервера");
    expect(capabilityHint(caps, "вовсе-нет", "en")).toContain("вовсе-нет");
  });

  test("перевод спрашивается наравне с остальными возможностями", () => {
    // Пробел охвата: пять кнопок спрашивали состояние, перевод — нет, и человек
    // узнавал о выжженной квоте DeepL только после нажатия.
    expect(isCapabilityBlocked(caps, "translate")).toBe(true);
    expect(capabilityHint(caps, "translate", "en")).toContain("Translation");
  });
});
