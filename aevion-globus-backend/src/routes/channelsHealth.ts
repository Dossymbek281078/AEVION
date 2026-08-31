import { Router, type Request, type Response } from "express";
import { lemonSqueezyTiersConfigured } from "../data/lemonSqueezyVariants";

/**
 * GET /api/health/channels — работает ли то, что мы ОБЕЩАЕМ человеку.
 *
 * Повод. 19.08.2026 выяснилось, что зарегистрироваться нельзя ни одним из
 * четырёх способов: оба OAuth-провайдера не настроены (кнопки при этом
 * показываются и дают 503), а подтверждение адреса создаёт токен и отвечает
 * `{ok:true}`, не отправляя письма. Ни одна наша проверка этого не видела:
 * сайт отвечал 200, `/health` отдавал `ok`, Sentry молчал — потому что все
 * они спрашивают «отвечает ли сервер», а не «получилось ли у человека».
 *
 * Отдельные ручки состояния к тому дню были у ДВУХ каналов из шести: оплата
 * (`/api/pricing/checkout/healthz`) и почта (`/api/auth/email/healthz`,
 * сделана в тот же день). Про остальные снаружи нельзя было сказать ничего,
 * и ответ приходилось искать в переменных окружения хостинга.
 *
 * Здесь они собраны в одном месте и сведены к двум вопросам, которые и
 * задаёт владелец: МОЖЕТ ЛИ ЧЕЛОВЕК ЗАРЕГИСТРИРОВАТЬСЯ и МОЖЕТ ЛИ ЗАПЛАТИТЬ.
 *
 * СЕКРЕТОВ НЕ ОТДАЁМ. Только признак наличия — ни значений, ни длин, ни
 * префиксов: по длине ключа и первым символам его подбирают.
 */

export const channelsHealthRouter = Router();

const set = (name: string): boolean => Boolean(process.env[name]?.trim());

channelsHealthRouter.get("/channels", (_req: Request, res: Response) => {
  // ── вход ─────────────────────────────────────────────────────────────
  const google = set("GOOGLE_OAUTH_CLIENT_ID") && set("GOOGLE_OAUTH_CLIENT_SECRET");
  const github = set("GITHUB_OAUTH_CLIENT_ID") && set("GITHUB_OAUTH_CLIENT_SECRET");
  const smtp = set("SMTP_HOST") && set("SMTP_USER") && set("SMTP_PASS");
  const resend = set("RESEND_API_KEY") || set("RESEND_KEY");
  const email = smtp || resend;

  // ── оплата ───────────────────────────────────────────────────────────
  const lemonsqueezy = set("LEMON_SQUEEZY_API_KEY") && set("LEMON_SQUEEZY_STORE_ID");
  const gumroad = set("GUMROAD_ACCESS_TOKEN");
  const paybox = set("PAYBOX_MERCHANT_ID") && set("PAYBOX_SECRET");
  const paypal = set("PAYPAL_CLIENT_ID") && set("PAYPAL_SECRET");

  // ── подписи вебхуков ─────────────────────────────────────────────────
  // Неподписанный приёмник оплаты — не «менее надёжно», а «права выдаются
  // по слову отправителя». Поэтому признак отдельный, а не внутри оплаты.
  const signedGumroad = set("GUMROAD_WEBHOOK_SECRET");
  const signedLemon = set("LEMON_SQUEEZY_WEBHOOK_SECRET");
  const signedPaypal = set("PAYPAL_WEBHOOK_ID");

  /**
   * ГЛАВНЫЕ ДВА ПОЛЯ. Остальное — подробности; читать их приходится, только
   * если одно из этих двух `false`.
   *
   * `canRegister` требует ХОТЯ БЫ ОДНОГО пути: подтверждение адреса письмом
   * либо любой OAuth. Ложное «да» здесь дороже ложного «нет»: человек уходит
   * молча и не пишет в поддержку.
   */
  /**
   * ── ПОЧТА: путей ТРИ, и провайдеры у них РАЗНЫЕ ────────────────────────
   *
   * 31.08.2026 два окна независимо намеряли состояние почты и получили
   * противоположные ответы — оба верные. Одно спрашивало путь входа (Resend,
   * работает), другое видело молчащую отправку (SMTP без пароля). Слово
   * «почта» покрывало три разных механизма, и каждый был прав про свой.
   *
   * Отсюда правило, ради которого этот блок и написан: «почта работает» — не
   * утверждение, пока не назван ПУТЬ. Поэтому здесь три отдельных признака, а
   * не один общий, и общего специально нет.
   */
  const brevo = set("BREVO_API_KEY");
  const mail = {
    // подтверждение адреса при регистрации
    signup: { configured: email, via: smtp ? "smtp" : resend ? "resend" : null },
    // подтверждение подписки в воронке — отдельный провайдер
    waitlist: { configured: brevo, via: "brevo" },
    // уведомление основателю о новой заявке на бирже стартапов.
    // Единственный потребитель SMTP: без пароля транспорт возвращает null и
    // функция молча выходит — заявка принята, а основатель о ней не узнаёт.
    founderNotify: { configured: smtp, via: "smtp" },
  };

  const canRegister = email || google || github;
  const canPay = lemonsqueezy || gumroad || paybox || paypal;
  // ДВА РАЗНЫХ ВОПРОСА, и раньше на них отвечало одно поле.
  //
  // `canPay` отвечает «есть ли настроенный провайдер» — то есть можем ли
  // мы в принципе принимать деньги. Но покупка не начнётся без ВАРИАНТА
  // товара у LemonSqueezy: он задаётся отдельной переменной на каждый
  // тариф. При заданных ключах и отсутствующем варианте `canPay` говорит
  // «да», а человек упирается в отказ.
  //
  // Замечено 29.08.2026 накануне запуска модуля: готовность называла цену,
  // а можно ли её заплатить — не отвечал никто.
  //
  // Поле НЕ переименовываю: у `canPay` есть свой смысл и свои тесты.
  // Добавляю второе, на второй вопрос.
  const canStartPurchase =
    (lemonsqueezy && lemonSqueezyTiersConfigured()) || gumroad || paybox || paypal;

  res.json({
    ok: true,
    canRegister,
    canPay,
    canStartPurchase,
    mail,
    signup: {
      email: { configured: email, via: { smtp, resend } },
      google: { configured: google },
      github: { configured: github },
    },
    payments: {
      lemonsqueezy: { configured: lemonsqueezy, signed: signedLemon },
      gumroad: { configured: gumroad, signed: signedGumroad },
      paybox: { configured: paybox },
      paypal: { configured: paypal, signed: signedPaypal },
    },
    // Что чинить в первую очередь, если canRegister/canPay = false.
    missing: [
      ...(email ? [] : ["SMTP_HOST+SMTP_USER+SMTP_PASS либо RESEND_API_KEY"]),
      ...(google ? [] : ["GOOGLE_OAUTH_CLIENT_ID+SECRET"]),
      ...(github ? [] : ["GITHUB_OAUTH_CLIENT_ID+SECRET"]),
      ...(gumroad && !signedGumroad ? ["GUMROAD_WEBHOOK_SECRET (оплата принимается без подписи)"] : []),
    ],
  });
});
