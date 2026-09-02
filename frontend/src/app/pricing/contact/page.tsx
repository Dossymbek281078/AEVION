"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";
import { usePricingT } from "@/lib/pricingI18n";
import { useI18n } from "@/lib/i18n";

type TierId = "free" | "lite" | "medium" | "full" | "enterprise";

interface LeadForm {
  name: string;
  email: string;
  company: string;
  industry: string;
  tier: TierId | "";
  seats: number;
  message: string;
}

const INITIAL: LeadForm = {
  name: "",
  email: "",
  company: "",
  industry: "",
  tier: "",
  seats: 5,
  message: "",
};

const INDUSTRIES = ["Банки и финтех", "Стартапы", "Госсектор", "Создатели контента", "Юр. фирмы", "Другое"];
const INDUSTRY_KEYS = ["banks", "startups", "government", "creators", "lawFirms", "other"];

function ContactInner() {
  const tp = usePricingT();
  const { t } = useI18n();
  const sp = useSearchParams();
  /*
   * Тема обращения из адреса: `?topic=purchase`.
   *
   * Соседнее окно уже ставит такие ссылки со страниц (glossary, affiliate), а
   * письмо о покупке ведёт сюда с `topic=purchase`. Без чтения параметра все
   * обращения выглядят одинаково, и письмо ЗАПЛАТИВШЕГО теряется среди
   * прочих — а это тот, кому мы уже должны.
   *
   * Отдельное поле не заводим: `source` уже сохраняется в записи обращения и
   * виден в админке. Второе поле про то же самое разъехалось бы с ним.
   *
   * Значение из адреса НЕ доверяем: оставляем только строчные буквы и дефис,
   * не длиннее двадцати. Иначе в запись уедет что угодно из чужой ссылки.
   */
  const темаИзАдреса = (sp.get("topic") ?? "").toLowerCase().replace(/[^a-z-]/g, "").slice(0, 20);
  const [form, setForm] = useState<LeadForm>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Префилл из query-параметров (deep-links с других страниц)
  useEffect(() => {
    const tier = sp.get("tier") as TierId | null;
    const industry = sp.get("industry");
    setForm((f) => ({
      ...f,
      tier: tier && ["free", "lite", "medium", "full", "enterprise"].includes(tier) ? tier : f.tier,
      industry: industry ?? f.industry,
    }));
  }, [sp]);

  function update<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/lead"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company || undefined,
          industry: form.industry || undefined,
          tier: form.tier || undefined,
          seats: form.seats,
          message: form.message || undefined,
          source: темаИзАдреса ? `pricing/contact:${темаИзАдреса}` : "pricing/contact",
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      track({
        type: "lead_submit",
        tier: form.tier || undefined,
        industry: form.industry || undefined,
        source: "pricing/contact",
        // Источник события намеренно ОСТАЁТСЯ прежним: сводка считает `bySource`
        // по точному совпадению строки, и метка в нём расщепила бы один
        // показатель на три — прежние числа «упали» бы на ровном месте.
        // Тема живёт в meta: там она видна и ничего не ломает.
        meta: {
          hasCompany: !!form.company,
          hasMessage: !!form.message,
          seats: form.seats,
          topic: темаИзАдреса || undefined,
        },
      });
      setSuccess(j.id);
    } catch (e: unknown) {
      /*
       * Человеку — понятная фраза, подробность — в журнал браузера.
       *
       * Здесь стояло `setError(e.message)`, и на экран уезжало сообщение
       * движка: внутренний адрес ручки, «Failed to parse URL», текст сетевой
       * ошибки. Соседнее окно 02.09 нашло тот же класс на странице цен — там
       * покупателю показывали адрес API и инструкцию запустить бэкенд.
       *
       * Место особенно неудачное: эта форма — единственный работающий канал
       * поддержки (у домена нет записи MX), и сюда пишет тот, у кого уже что-то
       * пошло не так. Технический текст здесь читается как «сломалось у них
       * совсем» и отваливает человека окончательно.
       *
       * Подробность не теряем: она нужна для разбора, но её место в журнале.
       */
      console.warn("[contact] отправка обращения не удалась:", e);
      setError(t("pricing.contact.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <ProductPageShell maxWidth={680}>
        <div style={{ marginBottom: 16 }}>
          <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {tp("back.allTiers")}
          </Link>
        </div>
        <div
          style={{
            padding: 40,
            textAlign: "center",
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            borderRadius: 16,
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 60, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.02em" }}>
            {tp("contact.success.title")}
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0, marginBottom: 20, opacity: 0.92 }}>
            {tp("contact.success.body")} <strong>{form.email}</strong>.
          </p>
          <p style={{ fontSize: 12, opacity: 0.7, margin: 0, marginBottom: 24 }}>
            {tp("contact.success.id")} <code>{success}</code>
          </p>
          <Link
            href="/pricing"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "rgba(255,255,255,0.16)",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {tp("contact.success.back")}
          </Link>
        </div>
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={680}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/pricing" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          {t("pricing.contact.backAllTiers")}
        </Link>
      </div>

      <section style={{ marginBottom: 32, textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "#0f172a",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          {tp("contact.badge")}
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 900,
            margin: 0,
            marginBottom: 8,
            letterSpacing: "-0.025em",
            color: "#0f172a",
          }}
        >
          {tp("contact.title")}
        </h1>
        <p style={{ fontSize: 14, color: "#475569", maxWidth: 520, margin: "0 auto" }}>
          {tp("contact.subtitle")}
        </p>
      </section>

      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label={tp("contact.field.name")} required>
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder={tp("contact.placeholder.name")}
              style={inputStyle}
            />
          </Field>
          <Field label={tp("contact.field.email")} required>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={tp("contact.placeholder.email")}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label={tp("contact.field.company")}>
            <input
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder={tp("contact.placeholder.company")}
              style={inputStyle}
            />
          </Field>
          <Field label={tp("contact.field.industry")}>
            <select
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
              style={inputStyle}
            >
              <option value="">{tp("contact.placeholder.industry")}</option>
              {INDUSTRIES.map((i, idx) => (
                <option key={i} value={i}>
                  {t(`pricing.contact.industry.${INDUSTRY_KEYS[idx]}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 14 }}>
          <Field label={tp("contact.field.tier")}>
            <select
              value={form.tier}
              onChange={(e) => update("tier", e.target.value as TierId | "")}
              style={inputStyle}
            >
              <option value="">{tp("contact.placeholder.tier")}</option>
              <option value="lite">Lite</option>
              <option value="medium">Medium</option>
              <option value="full">Full</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <Field label={tp("contact.field.seats")}>
            <input
              type="number"
              min={1}
              max={10000}
              value={form.seats}
              onChange={(e) => update("seats", Math.max(1, parseInt(e.target.value || "1", 10)))}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label={tp("contact.field.message")}>
          <textarea
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder={tp("contact.placeholder.message")}
            rows={5}
            style={{
              ...inputStyle,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </Field>

        {error && (
          <div
            style={{
              padding: 12,
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 13,
              marginTop: 14,
            }}
          >
            {t("pricing.contact.errorPrefix")} {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: submitting ? "wait" : "pointer",
              background: submitting
                ? "#cbd5e1"
                : "linear-gradient(135deg, #0d9488, #0ea5e9)",
              color: "#fff",
            }}
          >
            {submitting ? tp("contact.submitting") : tp("contact.submit")}
          </button>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {tp("contact.noSpam")}
          </span>
        </div>
      </form>
    </ProductPageShell>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: required ? "#0f172a" : "#475569",
          letterSpacing: "0.04em",
          display: "block",
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: "1px solid rgba(15,23,42,0.12)",
  borderRadius: 8,
  background: "#fff",
  color: "#0f172a",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactInner />
    </Suspense>
  );
}
