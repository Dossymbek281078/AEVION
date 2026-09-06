"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { track } from "@/lib/track";
import { useI18n } from "@/lib/i18n";
import { apiUrl } from "@/lib/apiBase";
import PurchaseReturnTracker from "@/components/PurchaseReturnTracker";
import { естьСледОплаты } from "@/lib/paymentTrace";
import { изСправочника } from "@/lib/mapLookup";

const APP_LINKS: Record<string, { name: string; href: string }> = {
  qcoreai:    { name: "QCoreAI", href: "/qcoreai" },
  healthai:   { name: "HealthAI", href: "/healthai" },
  qlearn:     { name: "QLearn", href: "/qlearn" },
  psyapp:     { name: "PsyApp", href: "/psyapp-deps" },
  "psyapp-deps": { name: "PsyApp", href: "/psyapp-deps" },
  qstore:     { name: "QStore", href: "/qstore" },
  deepsan:    { name: "DeepSan", href: "/deepsan" },
  qpersona:   { name: "QPersona", href: "/qpersona" },
  lifebox:    { name: "LifeBox", href: "/lifebox" },
  shadownet:  { name: "ShadowNet", href: "/shadownet" },
  platform:   { name: "QRight", href: "/qright" },
  ventures: { name: "AEVION Ventures", href: "/ventures" },
  "multichat-engine": { name: "AEVION Multichat Engine", href: "/multichat-engine" },
  qfusionai: { name: "QFusionAI", href: "/qfusionai" },
  qright: { name: "QRight", href: "/qright" },
  qsign: { name: "QSign", href: "/qsign" },
  qtradeoffline: { name: "QTradeOffline", href: "/qtradeoffline" },
  qmaskcard: { name: "QMaskCard", href: "/qmaskcard" },
  veilnetx: { name: "VeilNetX", href: "/veilnetx" },
  cyberchess: { name: "CyberChess", href: "/cyberchess" },
  qlife: { name: "QLife", href: "/qlife" },
  qgood: { name: "QGood", href: "/qgood" },
  "kids-ai-content": { name: "Kids AI Content", href: "/kids-ai-content" },
  "voice-of-earth": { name: "Voice of the Earth Series", href: "/voice-of-earth" },
  "startup-exchange": { name: "Startup Exchange", href: "/startup-exchange" },
  qventure: { name: "QVenture", href: "/qventure" },
  qskyway: { name: "QSkyway", href: "/qskyway" },
  qreal: { name: "QReal Studio", href: "/qreal" },
  mapreality: { name: "MapReality", href: "/mapreality" },
  "z-tide": { name: "Z-Tide", href: "/z-tide" },
  qcontract: { name: "QContract", href: "/qcontract" },
  qchaingov: { name: "QChainGov", href: "/qchaingov" },
  "smeta-trainer": { name: "Smeta Trainer", href: "/smeta-trainer" },
  qnews: { name: "QNews", href: "/qnews" },
  qmedia: { name: "QMedia", href: "/qmedia" },
  qai: { name: "QAI", href: "/qai" },
  qevents: { name: "QEvents", href: "/qevents" },
  constitution: { name: "Constitution", href: "/constitution" },
};

/** Как называется платёжный сервис на экране. Имена не склоняются, поэтому
 *  подставляются во все три языка без переделки фразы. */
const PROCESSOR_LABEL: Record<string, string> = {
  lemonsqueezy: "Lemon Squeezy",
  gumroad: "Gumroad",
  paypal: "PayPal",
  paybox: "PayBox",
};

function SuccessInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");
  // Gumroad redirects back with ?sale_id=...; keep _ptxn as a legacy fallback.
  const saleId = sp.get("sale_id") ?? sp.get("_ptxn");
  // Кто именно принял платёж. Раньше здесь стояло `?? "gumroad"`, и страница
  // писала «квитанция от Gumroad», «управление подпиской в аккаунте Gumroad»
  // ВСЕМ — включая тех, кто заплатил через Lemon Squeezy (сейчас это основной
  // провайдер подписок) или PayPal. Человека отправляли искать подписку в
  // аккаунт, которого у него нет. Определяем по тем меткам, которые реально
  // приходят: PayPal и PayBox возвращают ?paypal=1 / ?paybox=1, Gumroad —
  // ?sale_id, Lemon Squeezy — ?provider=lemonsqueezy.
  const provider =
    sp.get("provider") ??
    (sp.get("paypal") ? "paypal" : null) ??
    (sp.get("paybox") ? "paybox" : null) ??
    (sp.get("gumroad") || saleId ? "gumroad" : null);
  // Название сервиса пишем, только если знаем его наверняка. Не знаем —
  // строка без названия: выдуманное имя хуже отсутствующего.
  // Спрашиваем СВОЙ ключ, а не просто индексируем: `provider` приходит из
  // адреса, а у обычного объекта имена `constructor` и `toString` разрешаются
  // в наследство. Замер рендером 04.09.2026 на `?provider=constructor`:
  // человек сразу после оплаты видел «paid via function Object() { [native
  // code] }» — и то же самое ещё дважды, в строке про письмо и про управление
  // подпиской. Список касс закрытый, поэтому проверка своего ключа тут точнее,
  // чем объект без прототипа: незнакомое имя обязано давать пустоту.
  const processor = изСправочника(PROCESSOR_LABEL, provider) ?? null;
  const stub = sp.get("stub") === "true";
  const tier = sp.get("tier") ?? sp.get("tierId");
  const period = sp.get("period");
  const totalCents = sp.get("total");
  const trialDays = sp.get("trial") ? parseInt(sp.get("trial")!, 10) : 0;
  const appId = sp.get("appId") ?? "platform";

  const totalUsd = totalCents ? Math.round(parseInt(totalCents, 10) / 100) : null;
  const trialEndDate =
    trialDays > 0
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toLocaleDateString("ru-RU")
      : null;

  /*
   * Что человек купил — знаем НЕ ВСЕГДА, и врать об этом нельзя.
   *
   * Замер 31.08.2026 в браузере: страница возврата говорила «Pro активирован!»
   * на голом адресе и предлагала «Открыть QRight →» независимо от покупки.
   * Проверено по коду всех четырёх касс: параметр appId не кладёт НИ ОДНА, то
   * есть ссылку на QRight видел КАЖДЫЙ покупатель — включая тех, кто заплатил
   * за QSign, QLearn или QCoreAI. Тариф теряется реже, но тоже теряется: у
   * PayBox в адрес возврата уходит ref, а не tier, и казахстанский покупатель
   * Lite читал «Pro активирован».
   *
   * Здесь тот же приём, что автор уже применил ниже к пункту «управлять
   * подпиской»: не знаем — не называем. Неизвестный продукт ведёт в каталог,
   * неизвестный тариф даёт «Оплата принята» без имени.
   */
  const knownApp = Object.prototype.hasOwnProperty.call(APP_LINKS, appId) && appId !== "platform";
  const appLink = knownApp ? APP_LINKS[appId] : null;

  /*
   * ⚠️ 31.08.2026: экран УТВЕРЖДАЛ активацию, ничего не спросив.
   *
   * Замер: 305 строк, обращений к серверу НОЛЬ. Тариф брался из адреса
   * (`?tier=pro`), и любой, кто открыл ссылку — или вернулся кнопкой «назад»,
   * бросив оплату, — читал «Pro активирован!». На самом дорогом экране
   * платформы, сразу после того, как деньги списаны.
   *
   * Это не падение и не ошибка: страница уверенно отвечает успехом. Именно
   * поэтому её не видел ни один тест — ей нечем было упасть.
   *
   * Теперь спрашиваем сервер, кто мы есть, и сверяем с тем, что обещает адрес.
   * Три состояния, а не два:
   *
   *   null   ещё спрашиваем      — «оплата принята, проверяем доступ»
   *   true   тариф подтверждён   — «активирован», и это правда
   *   false  не подтверждён      — «доступ появится за несколько минут»
   *
   * Третье состояние — не «ошибка»: у гостя без входа доступ и не может быть
   * виден, а выдача после оплаты занимает секунды. Врать в эту сторону тоже
   * нельзя — поэтому текст не пугает, а называет, что делать, если не появится.
   */
  /*
   * Признак настоящего возврата — ОБЩИЙ, а не своя проверка по provider.
   * Замер соседнего окна: у Lemon Squeezy провайдера в адресе НЕТ вовсе, есть
   * только сумма. Своя проверка молча не засчитывала бы их продажи.
   */
  const следОплаты = естьСледОплаты({
    provider,
    ref: saleId ?? sessionId,
    total: totalUsd,
    stub,
  });

  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  /*
   * Мерж 06.09.2026: ВТОРОЙ вопрос серверу — из ветки платежей. Первый
   * (entitlements, ниже) отвечает про АККАУНТ и требует входа; этот — про
   * ВЫДАЧУ ПО ПЛАТЕЖУ (`/api/pricing/checkout/status?intentId=`), работает и
   * гостю. Дефолт «Pro» их стороны НЕ взят: правило страницы — не знаем, не
   * называем.
   *
   * Ручка отвечает тремя исходами, и «не смогли проверить» мы НЕ выдаём за
   * «не выдано»: в этом случае просто оставляем то, что знали до вопроса.
   * 400 повторять бессмысленно (идентификатора нет и не появится); прочие
   * неудачи — в повтор: вебхук от кассы приходит за секунды, но не мгновенно.
   */
  const [подтверждённый, setПодтверждённый] = useState<string | null>(null);
  const intentId = sessionId ?? saleId;

  useEffect(() => {
    if (!intentId) return;
    let отменено = false;
    let попыток = 0;
    const спросить = async () => {
      попыток += 1;
      try {
        const r = await fetch(apiUrl(`/api/pricing/checkout/status?intentId=${encodeURIComponent(intentId)}`));
        if (r.status === 400) return;
        if (!r.ok) {
          if (!отменено && попыток < 8) setTimeout(спросить, 2500);
          return;
        }
        const j = (await r.json()) as { ready?: boolean; tier?: string };
        if (!отменено && j.ready && j.tier) {
          setПодтверждённый(j.tier);
          // Выдача по ЭТОМУ платежу состоялась — это и есть подтверждение,
          // более сильное, чем совпадение тарифа аккаунта.
          setConfirmed(true);
          return;
        }
      } catch {
        // Сеть недоступна — это НЕ «не выдано». Молча пробуем ещё раз.
      }
      if (!отменено && попыток < 8) setTimeout(спросить, 2500);
    };
    void спросить();
    return () => {
      отменено = true;
    };
  }, [intentId]);

  // Имя тарифа: подтверждённое сервером сильнее адресной строки; ничего не
  // знаем — не называем (никакого дефолта).
  const источникТарифа = подтверждённый ?? tier;
  const tierName = источникТарифа
    ? источникТарифа.charAt(0).toUpperCase() + источникТарифа.slice(1)
    : null;

  useEffect(() => {
    if (stub) return;
    let живо = true;
    fetch(apiUrl("/api/me/entitlements"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!живо) return;
        const план = String(d?.plan ?? "").toLowerCase();
        // Тариф из адреса подтверждён, если сервер называет ТОТ ЖЕ. Незнание
        // тарифа (PayBox не кладёт его в адрес) — не подтверждение: тогда
        // достаточно того, что сервер видит любой платный.
        const ждали = String(tier ?? "").toLowerCase();
        setConfirmed(ждали ? план === ждали : план !== "" && план !== "free");
      })
      .catch(() => {
        // Отказ сети — это «не знаем», а не «не активировано». Тон текста
        // одинаков для обоих: мы не обещаем и не пугаем.
        // Три исхода, а не два: null это «не знаем». Стояло false, и на экране
        // разницы нет — но false означает «сервер сказал НЕТ», а сеть молчала.
        // Следующий, кто напишет по нему «активация не прошла», обвинит
        // покупателя в неоплате из-за собственного обрыва связи.
        if (живо) setConfirmed(null);
      });
    return () => {
      живо = false;
    };
  }, [stub, tier]);

  /*
   * ⚠️ ЧТО ЗДЕСЬ ЗАЩИЩАЕТ, а что оказалось декорацией.
   *
   * `tier` приходит из адреса и попадал в заголовок как есть, с заглавной
   * буквы: `?trial=14&tier=Zolotoy` давал «пробный доступ Zolotoy» на нашем
   * домене — на экране, который человек читает как подтверждение покупки.
   *
   * Защищают ДВА условия ниже: ветка триала и ветка активации обе требуют
   * `confirmed === true`, а подтверждение ставится, только когда сервер
   * назвал ТОТ ЖЕ тариф. Значит там, где имя вообще доходит до экрана, оно
   * уже сверено с сервером.
   *
   * Сперва я завёл здесь ещё и `tierName = confirmed ? tierName : null`
   * и счёл это защитой. Мутация показала обратное: тест зелен и с ним, и без
   * него — переменная недостижима иначе как при подтверждении. Убрал: код,
   * который выглядит защитой и ничего не охраняет, дороже отсутствующего.
   */

  /*
   * ⚠️ 01.09.2026: перешёл на ОБЩИЙ компонент учёта, отменив собственное
   * исключение.
   *
   * Вчера я оставил здесь свой учёт намеренно: общий PurchaseReturnTracker не
   * нёс тариф, сумму и период, а в этом событии они есть — замена стоила бы
   * трёх полей воронки. Сказал об этом соседнему окну, и оно ПОЧИНИЛО
   * инструмент: теперь компонент принимает и tier, и value, и meta.
   *
   * Причина исключения исчезла — значит исчезнуть должно и исключение.
   * Оставить копию «потому что так уже сделано» значило бы держать второй
   * способ делать то же самое, а он рано или поздно разойдётся с первым.
   */

  return (
    <ProductPageShell maxWidth={680}>
      {/* Учёт возврата — общим компонентом. Он гейтит по признаку оплаты и
          защищён от повторной отрисовки; тариф, сумму и период принимает с
          01.09, поэтому своя копия здесь больше не нужна. */}
      {/*
        Признак настоящего возврата берём ОБЩИЙ (`естьСледОплаты`), а не свою
        проверку по provider. Причина в замере соседнего окна: у Lemon Squeezy
        провайдера в адресе НЕТ вовсе, есть только сумма — моя проверка молча
        не засчитывала бы их продажи. Общий признак знает все четыре кассы.
      */}
      {следОплаты && (
        <PurchaseReturnTracker
          source="pricing"
          provider={provider ?? "unknown"}
          tier={tier ?? undefined}
          value={totalUsd ?? undefined}
          meta={{ period: period ?? null, sessionId: sessionId ?? saleId ?? null, stub }}
        />
      )}
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {t("pricing.checkoutSuccess.backAllTiers")}
        </Link>
      </div>

      {/* Main card */}
      <div
        style={{
          padding: "40px 36px",
          textAlign: "center",
          background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
          color: "#fff",
          borderRadius: 20,
          marginTop: 24,
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {stub ? "🔬" : "🎉"}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
          {stub
            ? t("pricing.checkoutSuccess.titleStub")
            : trialDays > 0 && confirmed === true
              ? tierName
                ? t("pricing.checkoutSuccess.titleTrial", { tier: tierName, days: trialDays })
                : t("pricing.checkoutSuccess.titleTrialNoTier", { days: trialDays })
              : confirmed === true
                ? tierName
                  ? t("pricing.checkoutSuccess.titleActivated", { tier: tierName })
                  : t("pricing.checkoutSuccess.titleActivatedNoTier")
                : /*
                   * Пока сервер не подтвердил — «оплата принята», а не
                   * «активирован». Разница не в вежливости: второе человек
                   * читает как «можно идти пользоваться», и если выдача не
                   * прошла, он узнает об этом сам, наткнувшись на платную
                   * стену, и уже не свяжет одно с другим.
                   */
                  t("pricing.checkoutSuccess.titlePending")}
        </h1>

        {/* Subtitle */}
        <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", opacity: 0.92, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
          {stub
            ? t("pricing.checkoutSuccess.subtitleStub")
            : trialDays > 0 && confirmed === true
              ? t("pricing.checkoutSuccess.subtitleTrial", { date: trialEndDate ?? "" })
              : confirmed === true
                ? tierName
                  ? t("pricing.checkoutSuccess.subtitleActivated", { tier: tierName })
                  : t("pricing.checkoutSuccess.subtitleActivatedNoTier")
                : t("pricing.checkoutSuccess.subtitlePending")}
        </p>

        {/* Trial end date badge */}
        {!stub && trialEndDate && (
          <div
            style={{
              display: "inline-block",
              background: "rgba(255,255,255,0.18)",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              marginBottom: 20,
              border: "1px dashed rgba(255,255,255,0.35)",
            }}
          >
            {t("pricing.checkoutSuccess.firstCharge")} <strong>{trialEndDate}</strong>
            {period && <span style={{ opacity: 0.8 }}> · {period === "annual" ? t("pricing.checkoutSuccess.periodAnnual") : t("pricing.checkoutSuccess.periodMonthly")} {t("pricing.checkoutSuccess.subscriptionWord")}</span>}
          </div>
        )}

        {/* Amount */}
        {/*
          * Сумма — такое же утверждение, как и тариф: `?total=5000` рисовало
          * «Сумма: $50» рядом с «оплата принята», и вместе это читается как
          * «мы получили от вас 50 долларов». Пока сервер не подтвердил, мы
          * этого не знаем. Условие то же, что у заголовка и абзаца, — экран
          * должен говорить одним голосом.
          */}
        {!stub && confirmed === true && totalUsd !== null && totalUsd > 0 && (
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 20 }}>
            {t("pricing.checkoutSuccess.amountLabel")} <strong>${totalUsd}</strong>
          </div>
        )}

        {/* Provider badge */}
        {!stub && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 12px",
            fontSize: 12, marginBottom: 24, border: "1px solid rgba(255,255,255,0.2)",
          }}>
            <span>🔒</span>
            <span>{processor
              ? t("pricing.checkoutSuccess.providerBadge", { processor })
              : t("pricing.checkoutSuccess.providerBadgeNoName")}{period ? ` · ${period === "annual" ? t("pricing.checkoutSuccess.periodAnnual") : t("pricing.checkoutSuccess.periodMonthly")}` : ""}</span>
          </div>
        )}

        {/* Transaction ID */}
        {(saleId || sessionId) && (
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 20px" }}>
            {processor ?? "Session"}: <code style={{ fontFamily: "monospace" }}>{saleId ?? sessionId}</code>
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={appLink ? appLink.href : "/apps"}
            style={{
              display: "inline-block", padding: "13px 28px",
              background: "#fff", color: "#0d9488",
              borderRadius: 12, textDecoration: "none",
              fontWeight: 800, fontSize: 15,
            }}
          >
            {appLink
              ? t("pricing.checkoutSuccess.openApp", { app: appLink.name })
              : t("pricing.checkoutSuccess.openAppNoName")}{" "}→
          </Link>
          <Link
            href="/"
            style={{
              display: "inline-block", padding: "13px 24px",
              background: "rgba(255,255,255,0.14)", color: "#fff",
              borderRadius: 12, textDecoration: "none",
              fontWeight: 700, fontSize: 14,
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            {t("pricing.checkoutSuccess.home")}
          </Link>
        </div>
      </div>

      {/* What's next block */}
      {!stub && (
        <div style={{
          marginTop: 24, padding: "20px 24px",
          background: "#f8fafc", borderRadius: 14,
          border: "1px solid #e2e8f0",
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
            {t("pricing.checkoutSuccess.whatsNext")}
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {([
              { icon: "📧", text: processor
                  ? t("pricing.checkoutSuccess.nextEmail", { processor })
                  : t("pricing.checkoutSuccess.nextEmailNoName") },
              {
                icon: "🚀",
                text: appLink
                  ? t("pricing.checkoutSuccess.nextOpenApp", { app: appLink.name })
                  : t("pricing.checkoutSuccess.nextOpenAppNoName"),
              },
              // Куда идти управлять подпиской, можно сказать только зная сервис.
              // Не знаем — пункт не показываем, а не отправляем наугад.
              ...(processor
                ? [{ icon: "⚙️", text: t("pricing.checkoutSuccess.nextManage", { processor }) }]
                : []),
              // Вопрос сразу после оплаты — самый срочный на платформе. Пункт
              // ведёт в нашу форму с уже подставленной темой покупки, а не на
              // почтовый адрес: у домена нет MX, и письмо туда выглядело бы для
              // заплатившего человека как молчание в ответ.
              {
                icon: "💬",
                text: t("pricing.checkoutSuccess.nextQuestions"),
                href: "/pricing/contact?topic=purchase",
              },
            ] as Array<{ icon: string; text: string; href?: string }>).map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 10, fontSize: 13, color: "#475569" }}>
                <span>{item.icon}</span>
                <span>
                  {item.href ? (
                    <Link href={item.href} style={{ color: "#2563eb", textDecoration: "underline" }}>
                      {item.text}
                    </Link>
                  ) : (
                    item.text
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stub notice */}
      {stub && (
        <div style={{
          marginTop: 20, padding: "16px 20px",
          background: "#fef3c7", borderRadius: 12,
          border: "1px solid #fde68a", fontSize: 13, color: "#92400e",
        }}>
          <strong>{t("pricing.checkoutSuccess.stubNoticeTitle")}</strong> {t("pricing.checkoutSuccess.stubNoticeBody")}
        </div>
      )}
    </ProductPageShell>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={null}>
      <SuccessInner />
    </Suspense>
  );
}
