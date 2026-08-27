// Страница входа не должна предлагать способ, которым нельзя воспользоваться,
// и не должна объяснять человеку, какую переменную выставить на сервере.
//
// ЗАМЕР НА ПРОДЕ 27.08.2026: `GET /api/auth/oauth/providers` отвечает
//   {"providers":[{"id":"google","configured":false},
//                 {"id":"github","configured":false}]}
// — не настроен ни один. Условием отрисовки была ДЛИНА массива, а он приходит
// непустым, поэтому блок показывался всегда: два способа входа, из которых не
// работает ни один. Кнопки при этом честно погашены, то есть мёртвыми не были.
//
// И подсказка при наведении говорила: «Provider not configured. Set
// GOOGLE_OAUTH_CLIENT_ID on the backend» — внутренний жаргон на публичной
// странице регистрации.

import { describe, expect, it } from "vitest";
import {
  providerHint,
  shouldShowOauthBlock,
  type Provider,
} from "./oauthVisibility";

const google = (configured: boolean): Provider => ({
  id: "google",
  name: "Google",
  configured,
});
const github = (configured: boolean): Provider => ({
  id: "github",
  name: "GitHub",
  configured,
});

describe("блок внешних входов показывается, только если им можно воспользоваться", () => {
  it("прод на 27.08.2026: оба не настроены → блока нет", () => {
    // Главный случай, ради которого всё и написано.
    expect(shouldShowOauthBlock([google(false), github(false)])).toBe(false);
  });

  it("контроль: хотя бы один настроен → блок есть", () => {
    // Без этого проверка выше прошла бы и на функции, всегда дающей false,
    // а тогда блок исчез бы и после настройки провайдера.
    expect(shouldShowOauthBlock([google(true), github(false)])).toBe(true);
    expect(shouldShowOauthBlock([google(false), github(true)])).toBe(true);
    expect(shouldShowOauthBlock([google(true), github(true)])).toBe(true);
  });

  it("список ещё не пришёл (null) → блока нет", () => {
    // Пустое место честнее кнопки, про которую неизвестно, работает ли она.
    expect(shouldShowOauthBlock(null)).toBe(false);
  });

  it("пустой список → блока нет", () => {
    expect(shouldShowOauthBlock([])).toBe(false);
  });

  it("длина списка сама по себе НЕ основание показывать блок", () => {
    // Ровно та ошибка, что была в коде: `providers.length > 0` истинно при
    // нуле настроенных, потому что список приходит непустым всегда.
    const both = [google(false), github(false)];
    expect(both.length).toBeGreaterThan(0);
    expect(shouldShowOauthBlock(both)).toBe(false);
  });
});

describe("подсказка говорит по-человечески", () => {
  it("настроенный провайдер — обычное приглашение", () => {
    expect(providerHint(google(true))).toBe("Войти через Google");
  });

  it("ненастроенный — что делать человеку, а не что выставить на сервере", () => {
    const hint = providerHint(github(false));
    expect(hint).toMatch(/не подключён/);
    expect(hint).toMatch(/почтой/);
  });

  it.each([google(false), github(false), google(true), github(true)])(
    "ни в одной подсказке нет имён переменных окружения ($id, configured=$configured)",
    (p) => {
      const hint = providerHint(p);
      expect(hint).not.toMatch(/CLIENT_ID|CLIENT_SECRET|OAUTH_|backend|env/i);
    },
  );

  it("имя провайдера в подсказке настоящее — в ОБЕИХ ветках", () => {
    // Иначе подсказка у GitHub говорила бы «через Google».
    // Обе ветки проверяются намеренно: первая версия теста трогала только
    // ненастроенную, и мутация «имя зашито» в настроенной ветке выжила.
    expect(providerHint(github(false))).toMatch(/GitHub/);
    expect(providerHint(google(false))).toMatch(/Google/);
    expect(providerHint(github(true))).toMatch(/GitHub/);
    expect(providerHint(google(true))).toMatch(/Google/);
  });
});
