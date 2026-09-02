import { Router, type Request, type Response } from "express";
import { emailQuotaToday } from "../lib/brevoQuota";
import { lemonSqueezyTiersConfigured } from "../data/lemonSqueezyVariants";

import { variantMappingStatus } from "../data/lemonSqueezyVariants";

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
  // Сколько писем ушло сегодня: у провайдера суточный потолок, и скрипт
  // рассылки в отдельном процессе иначе о нём не узнает.
  const quota = emailQuotaToday();
  /*
   * Расход за сутки — операционное число, и наружу оно не нужно: по нему видно,
   * сколько на платформе движения. Отдаём только по админскому заголовку, тем
   * же способом, что уже принят в events.ts. Потолок остаётся открытым: это
   * свойство нашего тарифа у провайдера, а не показательподвижности.
   *
   * Скрипту рассылки поле нужно, и токен у него есть. Не получил — берёт
   * половину потолка и говорит об этом вслух, то есть закрытие поля делает
   * рассылку осторожнее, а не ломает её.
   */
  const нуженТокен = process.env.ADMIN_TOKEN?.trim();
  const токенПришёл = (_req.headers["x-admin-token"] as string | undefined)?.trim();
  const свой = !нуженТокен || токенПришёл === нуженТокен;
  const mail = {
    ...(свой ? { sentToday: quota.count } : {}),
    dailyCap: quota.cap,
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

  /**
   * ТРЕТИЙ ВОПРОС, которого здесь не было: превращается ли оплата в доступ.
   *
   * `canPay` отвечает «провайдер настроен», и этого мало. Выдача прав висит на
   * переменной КОНКРЕТНОГО варианта товара: не задана — вебхук заплатившего
   * доходит до `ignored` и возвращает `ok: true`, не выдав ничего. Магазин
   * деньги принял, покупатель прав не получил, тревоги нет ни у кого.
   *
   * Поэтому поле отдельное, а не внутри `canPay`: молчаливая правка смысла
   * старого поля хуже нового поля — на `canPay` уже кто-то ссылается.
   *
   * Порог намеренно «хотя бы один», а не «все»: часть товаров может быть ещё
   * не выставлена, и вечно красная проверка перестаёт читаться. Список
   * несопоставленных отдаётся рядом — по нему видно, чего именно нет.
   */
  const variants = variantMappingStatus();
  // Годным считается вариант, у которого переменная задана И выглядит
  // идентификатором. Прежде здесь стояло «переменная непуста»: мусор в
  // значении доезжает до кассы как NaN, а состояние оставалось зелёным.
  const usableVariants = variants.varsSet - variants.malformed.length;
  const canGrant = !lemonsqueezy || usableVariants > 0;

  res.json({
    ok: true,
    canRegister,
    canPay,
      canGrant,
      canStartPurchase,
      mail,
    signup: {
      email: { configured: email, via: { smtp, resend } },
      google: { configured: google },
      github: { configured: github },
    },
    payments: {
      lemonsqueezy: {
        configured: lemonsqueezy,
        signed: signedLemon,
        // Наружу — только наши внутренние имена товаров, не идентификаторы.
        variants: {
          total: variants.total,
          varsSet: variants.varsSet,
          malformed: variants.malformed,
          unmapped: variants.unmapped,
        },
      },
      gumroad: { configured: gumroad, signed: signedGumroad },
      paybox: { configured: paybox },
      paypal: { configured: paypal, signed: signedPaypal },
    },
    // Что чинить в первую очередь, если canRegister/canPay = false.
    missing: [
      ...(email ? [] : ["SMTP_HOST+SMTP_USER+SMTP_PASS либо RESEND_API_KEY"]),
      ...(google ? [] : ["GOOGLE_OAUTH_CLIENT_ID+SECRET"]),
      ...(github ? [] : ["GITHUB_OAUTH_CLIENT_ID+SECRET"]),
      ...(lemonsqueezy && variants.malformed.length > 0
        ? ["LEMON_SQUEEZY_VARIANT_* задан(ы) не числом: " + variants.malformed.join(", ") +
           " — в кассу уедет NaN, доступ не выдастся"]
        : []),
      ...(lemonsqueezy && usableVariants === 0
        ? ["LEMON_SQUEEZY_VARIANT_* (деньги принимаются, доступ не выдаётся ни за один товар)"]
        : []),
      ...(gumroad && !signedGumroad ? ["GUMROAD_WEBHOOK_SECRET (оплата принимается без подписи)"] : []),
    ],
  });
});
