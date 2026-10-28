"use client";

/**
 * /services — три платные услуги с образцами и ценами (слово основателя 28.10.2026).
 * Язык ru/en — из общего механизма, словарь свой (без t("…"): первый t( в файле будит
 * сторож attrI18n, урок 21.10). Метка ?c= доезжает до кассы: withChannel для Lemon
 * Squeezy, keepChannelOrProbe для формы. Образцы сделаны ИИ — у каждого плашка.
 */
import { useEffect, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { BuyLink } from "@/components/BuyLink";
import { AiBadge } from "@/components/AiBadge";
import { useI18nOptional } from "@/lib/i18n";
import { track } from "@/lib/track";
import { channelFrom, keepChannelOrProbe, withChannel } from "@/lib/products";
import { SERVICES, type Service, type ServiceTier } from "@/data/services";

const ТЕКСТ = {
  ru: {
    eyebrow: "Услуги",
    h1: "Сделаем за вас: ролики, фото товаров, перевод",
    lead: "Три услуги, которые мы делаем своими ИИ-инструментами. Ниже — настоящие образцы, сделанные 28 октября, и цены. Готово за 1–3 рабочих дня.",
    sampleLabel: "Образец",
    order: "Заказать",
    orderForm: "Заказать через форму",
    perMonth: "в месяц",
    perMin: "за минуту",
    video: {
      name: "ИИ-ролики для бизнеса",
      what: "Вертикальные ролики 15–30 с для Reels, Shorts и TikTok: сценарий под ваш бизнес, видео, озвучка на русском, казахском или английском, субтитры и обложки.",
      sample: "Кофейня: ролик собран по трём кадрам и голосу — всё сгенерировано.",
      unit: (n: number) => `${n} роликов`,
      term: "готовы за 3 рабочих дня",
    },
    photo: {
      name: "ИИ-фото товаров для маркетплейсов",
      what: "Карточки для Kaspi, Wildberries и Ozon по одному фото продавца: главное на белом фоне, товар в интерьере, инфографика с характеристиками.",
      sample: "Кружка: слева фото продавца, справа — три карточки.",
      unit: (n: number) => `${n} карточек`,
      term: "готово за 1 рабочий день",
    },
    dub: {
      name: "Перевод и озвучка роликов",
      what: "Ваш ролик на другом языке с подгонкой губ: русский ↔ английский. Голос и артикуляция совпадают с оригиналом. Казахский язык пока не поддерживается.",
      sample: "15 секунд: русский оригинал, затем английская версия.",
      trial: "Проба: ролик до 60 секунд",
      perMinute: "Дальше",
      term: "проба готова за 2 рабочих дня",
    },
    pay: "Оплата картой через Lemon Squeezy. Если кнопка ведёт на форму — ссылка на оплату ещё подключается, мы ответим в тот же день.",
    back: "← Все цены",
  },
  en: {
    eyebrow: "Services",
    h1: "Done for you: videos, product photos, translation",
    lead: "Three services we deliver with our own AI tools. Below are real samples made on 28 October and the prices. Ready in 1–3 business days.",
    sampleLabel: "Sample",
    order: "Order",
    orderForm: "Order via form",
    perMonth: "per month",
    perMin: "per minute",
    video: {
      name: "AI videos for your business",
      what: "Vertical 15–30 s clips for Reels, Shorts and TikTok: a script for your business, video, voice-over in English, Russian or Kazakh, subtitles and covers.",
      sample: "Coffee shop: the clip is assembled from three frames and a voice. All of it is generated.",
      unit: (n: number) => `${n} videos`,
      term: "ready in 3 business days",
    },
    photo: {
      name: "AI product photos for marketplaces",
      what: "Listing images for Kaspi, Wildberries, Ozon and Amazon from a single seller photo: hero shot on white, the product in an interior, an infographic with specs.",
      sample: "Mug: the seller photo on the left, three listing images on the right.",
      unit: (n: number) => `${n} images`,
      term: "ready in 1 business day",
    },
    dub: {
      name: "Video translation and dubbing",
      what: "Your video in another language with lip sync: Russian ↔ English. Voice and articulation match the original. Kazakh is not supported yet.",
      sample: "15 seconds: the Russian original, then the English version.",
      trial: "Trial: a video up to 60 seconds",
      perMinute: "After that",
      term: "the trial is ready in 2 business days",
    },
    pay: "Card payment via Lemon Squeezy. If a button opens the form, the payment link is still being connected. We reply the same day.",
    back: "← All prices",
  },
} as const;

type Lang = keyof typeof ТЕКСТ;

const card: CSSProperties = { border: "1px solid rgba(15,23,42,0.1)", borderRadius: 16, padding: 20, background: "#fff", display: "grid", gap: 14 };
const h2: CSSProperties = { margin: 0, fontSize: 22, lineHeight: 1.25 };
const p: CSSProperties = { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#334155" };
const tierRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "stretch" };
const tierBox: CSSProperties = { flex: "1 1 160px", border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12, padding: "12px 14px", display: "grid", gap: 6, minWidth: 0 };
const price: CSSProperties = { fontSize: 24, fontWeight: 900, lineHeight: 1.1 };
const btn: CSSProperties = { display: "inline-block", textAlign: "center", padding: "10px 14px", borderRadius: 10, fontWeight: 800, fontSize: 14, color: "#fff", background: "linear-gradient(135deg,#0d9488,#0ea5e9)", textDecoration: "none" };
const btnForm: CSSProperties = { ...btn, background: "#0f172a" };
const media: CSSProperties = { width: "100%", maxWidth: 420, borderRadius: 12, display: "block", background: "#0f172a" };

function tierLabel(s: Service, t: ServiceTier, d: (typeof ТЕКСТ)[Lang]): string {
  if (s.id === "dub") return t.perUnit ? `${d.dub.perMinute} — $${t.priceUsd} ${d.perMin}` : d.dub.trial;
  const u = s.id === "video" ? d.video : d.photo;
  return t.monthly ? `${u.unit(t.qty)} ${d.perMonth}` : u.unit(t.qty);
}

export default function ServicesPage() {
  const i18n = useI18nOptional();
  const lang: Lang = i18n?.lang === "en" ? "en" : "ru";
  const d = ТЕКСТ[lang];
  const sp = useSearchParams();
  const raw = sp.get("c") ?? undefined;
  const channel = channelFrom(raw);

  useEffect(() => {
    track({ type: "page_view", source: "services" });
  }, []);

  return (
    <ProductPageShell maxWidth={960}>
      <p style={{ margin: "0 0 6px", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "#0d9488", fontWeight: 800 }}>{d.eyebrow}</p>
      <h1 style={{ margin: "0 0 10px", fontSize: 30, lineHeight: 1.15 }}>{d.h1}</h1>
      <p style={{ ...p, marginBottom: 24, fontSize: 16 }}>{d.lead}</p>

      <div style={{ display: "grid", gap: 20 }}>
        {SERVICES.map((s) => {
          const txt = d[s.id];
          return (
            <section key={s.id} id={s.id} style={card} aria-labelledby={`svc-${s.id}`}>
              <h2 id={`svc-${s.id}`} style={h2}>{txt.name}</h2>
              <p style={p}>{txt.what}</p>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#64748b" }}>{d.sampleLabel}</span>
                  <AiBadge style={{ margin: 0 }} />
                </div>
                {s.sample.kind === "video" ? (
                  <video src={s.sample.src} controls playsInline preload="metadata" style={media} data-service-sample={s.id} />
                ) : (
                  <img src={s.sample.src} alt={txt.sample} loading="lazy" style={media} data-service-sample={s.id} />
                )}
                <p style={{ ...p, fontSize: 13, color: "#64748b", marginTop: 6 }}>{txt.sample}</p>
              </div>
              <div style={tierRow}>
                {s.tiers.map((t) => (
                  <div key={t.id} style={tierBox} data-service-tier={t.id} data-price-usd={t.priceUsd}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{tierLabel(s, t, d)}</div>
                    <div style={price}>
                      ${t.priceUsd}
                      {t.monthly ? <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}> / {d.perMonth}</span> : null}
                    </div>
                    {t.checkoutUrl ? (
                      <BuyLink href={withChannel(t.checkoutUrl, channel, "services", raw)} source="services" productId={t.id} priceUsd={t.priceUsd} channel={channel} style={btn}>
                        {d.order}
                      </BuyLink>
                    ) : (
                      <Link href={keepChannelOrProbe(`/pricing/contact?topic=svc-${s.id}`, raw, channel)} style={btnForm} data-service-order={t.id}>
                        {d.orderForm}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              <p style={{ ...p, fontSize: 13, color: "#64748b" }}>{txt.term}</p>
            </section>
          );
        })}
      </div>

      <p style={{ ...p, marginTop: 20, fontSize: 13, color: "#64748b" }}>{d.pay}</p>
      <p style={{ marginTop: 16 }}>
        <Link href={keepChannelOrProbe("/pricing", raw, channel)} style={{ color: "#0d9488", fontWeight: 700 }}>{d.back}</Link>
      </p>
    </ProductPageShell>
  );
}
