"use client";

import Link from "next/link";
import { KeepChannelLink } from "./KeepChannelLink";
import { tierLabel, требуемоеСловами, языкСтены, type PaywallPayload, type CanonicalTier } from "@/lib/paywall";
import { WaitlistIfMissing } from "./FooterWaitlist";
import { useI18nOptional } from "@/lib/i18n";
import { useServerLang, языкКадра } from "@/lib/serverLangContext";

/**
 * Reusable blocking screen rendered when the backend returns a 402
 * upgrade_required response (see lib/paywall.ts). Pure presentation over the
 * payload — no own state.
 *
 * Visual contract:
 *   - clear module name + current plan
 *   - required tiers as visible chips
 *   - primary CTA → /pricing (anchored to the tier the user needs)
 *   - secondary "Back" link to the module's hub
 *
 * Pair with <PaywallScreen> in any page that calls fetchOrPaywall().
 *
 * Почему «use client» (30.10.2026, окно Приложения-2·Бюро). Экран рисуют
 * 17 страниц: 9 серверных (qcoreai, multichat-engine, healthai…) и 8 клиентских
 * (qai, qfusionai, qmedia, veilnetx…). Все подписи были зашиты по-русски для
 * любого языка — английский гость закрытого модуля читал «Перейти к тарифам →»
 * и «Уже оплатили?». Язык страницы живёт в I18nProvider (клиент), поэтому экран
 * становится клиентским компонентом: серверные страницы передают ему
 * сериализуемый payload, как и раньше.
 *
 * Язык кадра — языкКадра(i18n, серверный): I18nProvider стартует с «en» и
 * определяет язык уже в браузере, поэтому пока он не готов (langReady) берётся
 * язык, выбранный серверным макетом маршрута (ServerLangProvider, кука →
 * Accept-Language → ru). Так SSR-HTML, первый кадр и гидрация совпадают — без
 * английской вспышки перед оплатой у русского гостя (замечание Продукта 30.10).
 * Серверные страницы рисуют стену через ServerPaywallScreen (он даёт провайдер) —
 * сторож app/__tests__/paywallScreenServerLang.guard. Без серверного языка и до
 * langReady (клиентские страницы: qai, qmedia, veilnetx…) — document.lang, как у
 * PaywallModal: i18n.lang там ещё стартовое «en», а inline-скрипт уже выставил
 * язык документа по пути и куке (вычитка Продукта 30.10).
 */

type Яз = "ru" | "en" | "kk";

const СТРОКИ: Record<Яз, {
  back: string;
  titleAnyPaid: string;
  titleHigher: string;
  plan: (label: string) => [string, string];
  tiersAria: string;
  login: string;
  pricing: string;
  paid: string;
  status: string;
  waitTitle: string;
  waitDescription: string;
  waitButton: string;
}> = {
  ru: {
    back: "← На главную",
    titleAnyPaid: "Этот модуль входит в любую платную подписку",
    titleHigher: "Этот модуль доступен на старших тарифах",
    plan: () => ["Ваш текущий план — ", ". Чтобы открыть его, выберите один из тарифов ниже."],
    tiersAria: "Доступные тарифы",
    login: "Войти под почтой оплаты →",
    pricing: "Перейти к тарифам →",
    paid: "Уже оплатили? ",
    status: "Проверьте статус подписки",
    waitTitle: "Платить сегодня рано? Оставьте адрес",
    waitDescription: "Напишем, когда у AEVION откроются новые модули и возможности.",
    waitButton: "Сообщить мне",
  },
  en: {
    back: "← Home",
    titleAnyPaid: "This module is part of any paid plan",
    titleHigher: "This module is available on higher plans",
    plan: () => ["Your current plan is ", ". To open it, choose one of the plans below."],
    tiersAria: "Available plans",
    login: "Sign in with the payment email →",
    pricing: "Go to pricing →",
    paid: "Already paid? ",
    status: "Check your subscription status",
    waitTitle: "Not ready to pay today? Leave your address",
    waitDescription: "We will write when AEVION opens new modules and features.",
    waitButton: "Notify me",
  },
  kk: {
    back: "← Басты бетке",
    titleAnyPaid: "Бұл модуль кез келген ақылы жазылымға кіреді",
    titleHigher: "Бұл модуль жоғары тарифтерде қолжетімді",
    plan: () => ["Қазіргі жоспарыңыз — ", ". Ашу үшін төмендегі тарифтердің бірін таңдаңыз."],
    tiersAria: "Қолжетімді тарифтер",
    login: "Төлем поштасымен кіру →",
    pricing: "Тарифтерге өту →",
    paid: "Төлеп қойдыңыз ба? ",
    status: "Жазылым күйін тексеріңіз",
    waitTitle: "Бүгін төлеуге ерте ме? Мекенжай қалдырыңыз",
    waitDescription: "AEVION-да жаңа модульдер мен мүмкіндіктер ашылғанда жазамыз.",
    waitButton: "Маған хабарлау",
  },
};

/**
 * Акценты тарифов — 700-оттенки, потому что экран светлый.
 *
 * Раньше здесь стояли яркие 400/500 (#06b6d4, #f59e0b, #34d399): они читались
 * на тёмном фоне `#0f172a`, но этот же цвет используется КАК ТЕКСТ на подложке
 * `${color}22` и как фон кнопки под белым текстом. После перевода экрана в
 * светлую схему (2026-07-26) amber на белом давал ~2:1 при норме WCAG AA 4.5:1
 * — то есть «просто поменять фон» означало бы отдать нечитаемую страницу тем,
 * кому и так отказали в доступе. Значения подобраны под светлый фон.
 */
const TIER_ACCENT: Record<CanonicalTier, string> = {
  free: "#64748b",
  lite: "#0e7490",
  medium: "#6d28d9",
  full: "#b45309",
  enterprise: "#047857",
};

interface Props {
  payload: PaywallPayload;
  /** Optional hub path to link back to (e.g. "/modules"). Default: "/". */
  backHref?: string;
  /** Optional override label for the back link. Default: by language. */
  backLabel?: string;
}

export function PaywallScreen({ payload, backHref = "/", backLabel }: Props) {
  const i18n = useI18nOptional();
  const серверный = useServerLang();
  const кадр = серверный === null && !i18n?.langReady ? языкСтены() : языкКадра(i18n, серверный, языкСтены());
  const lang: Яз = кадр === "ru" || кадр === "kk" ? кадр : "en";
  const с = СТРОКИ[lang];
  const { plan, requiredTiers, upgradeUrl, authState, loginUrl } = payload;
  // Не вошёл → возможно, уже оплатил: главный шаг — вход под почтой оплаты, а
  // не «выбрать тариф» (иначе плательщику предлагают платить второй раз).
  const anonymous = authState === "anonymous";
  const primaryTier = requiredTiers[0] ?? "full";
  const accent = TIER_ACCENT[primaryTier] ?? "#f59e0b";
  const [planBefore, planAfter] = с.plan(tierLabel(plan));

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <Link
          href={backHref}
          style={{ fontSize: 12, color: "#64748b", textDecoration: "none", display: "inline-block", marginBottom: 24 }}
        >
          {backLabel ?? с.back}
        </Link>

        <div
          aria-hidden
          style={{
            fontSize: 48,
            lineHeight: 1,
            marginBottom: 16,
            filter: "grayscale(0.2)",
          }}
        >
          🔒
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 12px", lineHeight: 1.15 }}>
          {requiredTiers.includes("full")
            // Без служебного имени: «Модуль «qai»…» человеку ничего не говорит
            // (прод /qai, 24.10.2026); название модуля он и так видит в адресе и меню.
            ? с.titleAnyPaid
            : с.titleHigher}
        </h1>

        <p style={{ fontSize: 14, color: "#475569", margin: "0 0 24px", lineHeight: 1.5 }}>
          {planBefore}<strong style={{ color: "#0f172a" }}>{tierLabel(plan)}</strong>{planAfter}
        </p>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: 28,
          }}
          aria-label={с.tiersAria}
        >
          {/* Одна фраза вместо ярлыков: «FULL» в лестнице сроков значит 9 месяцев,
              а требование — «любой платный». Разбор в lib/paywall.ts. */}
          <span
            style={{
              padding: "6px 14px",
              background: `${accent}22`,
              border: `1px solid ${accent}66`,
              color: accent,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.04em",
            }}
          >
            {требуемоеСловами(requiredTiers, lang)}
          </span>
        </div>

        {/*
          Метка канала переживает переход к тарифам.

          Экран платной стены видит КАЖДЫЙ, кто пришёл в закрытый модуль без
          оплаты — это десять страниц. Ссылка «выбрать тариф» ведёт на /pricing,
          а та с 31.08 читает метку и доводит её до кассы. Без переноса метка
          терялась ровно перед страницей, которая её ждёт.
        */}
        {anonymous && loginUrl ? (
          <div style={{ marginBottom: 14 }}>
            <Link
              href={loginUrl}
              style={{
                display: "inline-block",
                padding: "12px 28px",
                background: accent,
                color: "#fff",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: `0 8px 24px -8px ${accent}99`,
              }}
            >
              {с.login}
            </Link>
          </div>
        ) : null}
        <KeepChannelLink
          href={upgradeUrl}
          style={{
            display: "inline-block",
            padding: "12px 28px",
            // Когда есть кнопка входа, «к тарифам» становится вторичной.
            background: anonymous && loginUrl ? "transparent" : accent,
            color: anonymous && loginUrl ? accent : "#fff",
            border: anonymous && loginUrl ? `1px solid ${accent}66` : "none",
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 800,
            textDecoration: "none",
            boxShadow: anonymous && loginUrl ? "none" : `0 8px 24px -8px ${accent}99`,
          }}
        >
          {с.pricing}
        </KeepChannelLink>

        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 28, lineHeight: 1.5 }}>
          {с.paid}<Link href="/account" style={{ color: "#0d9488", textDecoration: "underline" }}>{с.status}</Link>
        </p>

        {/*
          Тому, кто сегодня платить не готов, тоже есть что предложить — иначе он
          уходит бесследно. Этот экран видит КАЖДЫЙ, кто пришёл в закрытый модуль
          без оплаты: 19 страниц пользуются им (замер 20.09.2026), и ни на одной
          не было способа оставить адрес.

          Обещание держим буквальным: подписка пишется в constitution_waitlist и
          сразу шлёт подтверждающее письмо, а рассылка о новых модулях —
          единственное, что мы по ней делаем. Скидок и пробных доступов не
          обещаем: их нет.
        */}
        <div style={{ maxWidth: 520, margin: "28px auto 0", textAlign: "left" }}>
          <WaitlistIfMissing
            source="paywall"
            lang={lang}
            title={с.waitTitle}
            description={с.waitDescription}
            buttonLabel={с.waitButton}
          />
        </div>
      </div>
    </main>
  );
}
