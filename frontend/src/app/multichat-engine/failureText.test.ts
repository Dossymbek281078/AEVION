import { describe, test, expect } from "vitest";
import { agentFailure, agentTitle, retryHint } from "./failureText";

// Тексты отказов Консилиума. Проверяем два свойства, которые легко потерять:
// сообщение должно быть по-русски и не должно врать про причину.

describe("agentFailure — человеку понятно, правда не спрятана", () => {
  test("предел частоты назван личным — и это проверяется по смыслу, а не по фразе", () => {
    // Ровно та строка, которую отдаёт chatLimiter бэкенда.
    //
    // До 13.08.2026 здесь проверялось «общий предел»: лимитер считал по адресу
    // петли, и предел ДЕЙСТВИТЕЛЬНО был общим на всю платформу. Лимитер починен,
    // и этот тест ровно на один день охранял утверждение, ставшее ложным.
    // Отсюда форма проверки: смысл (личный / не чужой), а не точная формулировка.
    const f = agentFailure("rate_limit_exceeded: max 30 chat requests per minute");
    expect(f.human).toMatch(/личн/i);
    expect(f.human).not.toMatch(/общий предел|не ваш личный/i);
    expect(f.human).not.toMatch(/[a-z]{4,}/); // без английских слов в тексте для глаза
    // Исходная строка сохранена — отчёт пользователя остаётся полезным.
    expect(f.technical).toBe("rate_limit_exceeded: max 30 chat requests per minute");
  });

  test("исчерпанная квота не обещает, что поможет ожидание", () => {
    const f = agentFailure("provider_quota_exceeded");
    expect(f.human).toContain("Ожидание не поможет");
    // Именно этим она отличается от предела частоты: там ждать имеет смысл.
    expect(agentFailure("rate_limit_exceeded").human).toContain("через минуту");
  });

  test("пустой ответ не выглядит виной пользователя", () => {
    expect(agentFailure("empty reply from provider").human).toContain("сбой на его стороне");
  });

  test("неизвестная причина не получает выдуманного объяснения", () => {
    const f = agentFailure("ECONNRESET while reading socket");
    expect(f.human).toBe("Агент не ответил.");
    expect(f.technical).toBe("ECONNRESET while reading socket"); // и не потеряна
  });

  test("пустая причина не рисует пустую строку", () => {
    expect(agentFailure(undefined).human).toBe("Агент не ответил.");
    expect(agentFailure("   ").technical).toBe(null);
  });
});

describe("retryHint — время ожидания берётся из ответа сервера", () => {
  test("секунды и минуты", () => {
    expect(retryHint(12)).toBe(" Повторите через 12 с.");
    expect(retryHint(90)).toBe(" Повторите через 2 мин.");
  });

  test("нечисло и ноль не превращаются в «через 0 с»", () => {
    expect(retryHint(undefined)).toBe("");
    expect(retryHint(0)).toBe("");
    expect(retryHint("30")).toBe("");
    expect(retryHint(Number.NaN)).toBe("");
  });
});

describe("agentTitle — в заголовке роль, а не внутренний id", () => {
  test("берётся часть до тире", () => {
    expect(agentTitle("Аналитик — только факты и цифры, без оценок", "analyst")).toBe("Аналитик");
  });

  test("без роли остаётся id, а не пустой заголовок", () => {
    expect(agentTitle(undefined, "analyst")).toBe("analyst");
    expect(agentTitle("   ", "skeptic")).toBe("skeptic");
  });
});

describe("retryHint — округление ВВЕРХ, иначе совет отправляет на второй отказ", () => {
  // Мутация Math.ceil → Math.floor проходила незамеченной: ни один тест не давал
  // дробных секунд, а сервер отдаёт их именно такими (Retry-After с точностью до
  // десятых). При floor человеку говорят «через 16 с» на настоящих 16.2 — он
  // повторяет ровно в срок и получает отказ второй раз, уже не понимая почему.
  test("дробные секунды округляются вверх, а не вниз", () => {
    expect(retryHint(16.2)).toContain("17 с");
    expect(retryHint(0.3)).toContain("1 с");
  });

  test("целые секунды не раздуваются лишней единицей", () => {
    expect(retryHint(17)).toContain("17 с");
  });

  test("дробные минуты тоже вверх: 61.2 с — это две минуты ожидания, не одна", () => {
    // Тот же дефект на второй ветке: минутная ветка делит уже округлённое n.
    expect(retryHint(61.2)).toMatch(/2 мин/);
  });
});
