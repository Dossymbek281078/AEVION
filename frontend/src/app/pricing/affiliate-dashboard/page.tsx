"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";

interface AffiliateApplication {
  id: string;
  ts: string;
  name: string;
  email: string;
  organization: string | null;
  country: string | null;
  channel: string | null;
  status: string;
}

interface AffiliateStats {
  clicks: number;
  signups: number;
  mrr_usd: number;
  pending_payout_usd: number;
  paid_payout_usd: number;
  commission_percent: number;
  cookie_days: number;
}

interface DashboardPayload {
  application: AffiliateApplication;
  refCode: string;
  refLink: string;
  stats: AffiliateStats;
  history: Array<{ ts: string; kind: string; value?: number }>;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

export default function AffiliateDashboardPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const emailFromUrl = params?.get("email") ?? "";
  const tokenFromUrl = params?.get("token") ?? "";

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/affiliate-dashboard" });
  }, []);

  useEffect(() => {
    if (!emailFromUrl || !tokenFromUrl) return;
    setLoadingDash(true);
    fetch(
      apiUrl("/api/pricing/affiliate/dashboard") +
        `?email=${encodeURIComponent(emailFromUrl)}&token=${encodeURIComponent(tokenFromUrl)}`,
    )
      .then(async (r) => {
        if (r.status === 401) throw new Error("Ссылка устарела или некорректна");
        if (r.status === 404) throw new Error("Заявка не найдена. Сначала подайте заявку на /pricing/affiliate.");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: DashboardPayload) => setData(j))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingDash(false));
  }, [emailFromUrl, tokenFromUrl]);

  async function requestMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLinkSubmitting(true);
    setLinkError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/affiliate/magic-link"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      if (r.status === 429) throw new Error("Слишком много попыток. Попробуйте через 10 минут.");
      if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`);
      setLinkSent(true);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : String(err));
    } finally {
      setLinkSubmitting(false);
    }
  }

  function copyRef(link: string) {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  }

  if (emailFromUrl && tokenFromUrl) {
    return (
      <ProductPageShell maxWidth={920}>
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <Link href="/pricing/affiliate" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            ← Affiliate program
          </Link>
        </div>
        {loadingDash && <Skeleton />}
        {error && (
          <div
            style={{
              padding: 18,
              background: "#fef2f2",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 12,
              color: "#991b1b",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
            <div style={{ marginTop: 10 }}>
              <Link href="/pricing/affiliate-dashboard" style={{ fontSize: 12, fontWeight: 800, color: "#0d9488", textDecoration: "none" }}>
                ← Запросить новый magic-link
              </Link>
            </div>
          </div>
        )}
        {data && (
          <DashboardContent data={data} copied={copied} onCopy={() => copyRef(data.refLink)} />
        )}
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={520}>
      <div style={{ marginTop: 24, marginBottom: 16 }}>
        <Link href="/pricing/affiliate" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Affiliate program
        </Link>
      </div>

      <section style={{ textAlign: "center", padding: "12px 0 28px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #be185d, #ef4444)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          AFFILIATE DASHBOARD
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.025em" }}>
          Войти в affiliate-кабинет
        </h1>
        <p style={{ fontSize: 14, color: "#475569", maxWidth: 440, margin: "0 auto", lineHeight: 1.5 }}>
          Введите email с которым вы подавали заявку. Мы отправим magic-link на ваш ящик. Ссылка действительна для текущей сессии.
        </p>
      </section>

      {linkSent ? (
        <div
          style={{
            padding: 22,
            background: "#ecfdf5",
            border: "1px solid rgba(13,148,136,0.25)",
            borderRadius: 14,
            color: "#065f46",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>✉</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Ссылка отправлена</div>
          <div style={{ fontSize: 13, color: "#047857", lineHeight: 1.5 }}>
            Если email есть в системе — magic-link будет в вашем ящике через минуту. Проверьте папку «Спам».
          </div>
        </div>
      ) : (
        <form
          onSubmit={requestMagicLink}
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            padding: 24,
            boxShadow: CARD,
          }}
        >
          <label style={{ fontSize: 12, fontWeight: 800, color: "#475569", letterSpacing: "0.04em", display: "block", marginBottom: 8 }}>
            EMAIL
          </label>
          <input
            type="email"
            placeholder="you@company.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "12px 14px",
              fontSize: 14,
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.12)",
              boxSizing: "border-box",
            }}
          />
          {linkError && (
            <div style={{ marginTop: 10, padding: 8, background: "#fef2f2", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#991b1b", fontSize: 12 }}>
              {linkError}
            </div>
          )}
          <button
            type="submit"
            disabled={linkSubmitting || !emailInput.trim()}
            style={{
              width: "100%",
              marginTop: 14,
              padding: "12px 16px",
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 10,
              border: "none",
              cursor: linkSubmitting || !emailInput.trim() ? "not-allowed" : "pointer",
              background: linkSubmitting || !emailInput.trim() ? "#94a3b8" : "linear-gradient(135deg, #be185d, #ef4444)",
              color: "#fff",
            }}
          >
            {linkSubmitting ? "Отправка…" : "Прислать ссылку"}
          </button>
          <div style={{ marginTop: 14, fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Ещё нет заявки?{" "}
            <Link href="/pricing/affiliate" style={{ color: "#0d9488", fontWeight: 700, textDecoration: "none" }}>
              Подать на /pricing/affiliate →
            </Link>
          </div>
        </form>
      )}
    </ProductPageShell>
  );
}

function DashboardContent({
  data,
  copied,
  onCopy,
}: {
  data: DashboardPayload;
  copied: boolean;
  onCopy: () => void;
}) {
  const { application, refLink, refCode, stats } = data;

  return (
    <>
      <section style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#be185d", letterSpacing: "0.06em", marginBottom: 4 }}>
          AFFILIATE DASHBOARD
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
          Привет, {application.name}
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
          Заявка #{application.id} · {new Date(application.ts).toLocaleDateString("ru-RU")} · статус: {application.status}
        </p>
      </section>

      <section
        style={{
          background: "linear-gradient(135deg, #0f172a, #1e293b)",
          color: "#f8fafc",
          borderRadius: 16,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#fcd34d", letterSpacing: "0.06em", marginBottom: 8 }}>
          ВАШ РЕФЕРАЛЬНЫЙ КОД
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "ui-monospace, monospace", marginBottom: 10 }}>
          {refCode}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            background: "rgba(255,255,255,0.1)",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <code style={{ fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {refLink}
          </code>
          <button
            onClick={onCopy}
            style={{
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 800,
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: copied ? "#0d9488" : "#fff",
              color: copied ? "#fff" : "#0f172a",
              minWidth: 80,
            }}
          >
            {copied ? "Скопировано ✓" : "Копировать"}
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          Делитесь ссылкой в блогах, рассылках, соцсетях. Cookie работает {stats.cookie_days} дней.
          Комиссия — {stats.commission_percent}% recurring lifetime от всех подписок приведённых клиентов.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Stat label="КЛИКИ" value={stats.clicks.toLocaleString("ru-RU")} accent="#0ea5e9" />
        <Stat label="SIGNUPS" value={stats.signups.toLocaleString("ru-RU")} accent="#7c3aed" />
        <Stat label="MRR" value={`$${stats.mrr_usd.toLocaleString("en-US")}`} accent="#0d9488" />
        <Stat label="PAYOUT (ОЖИДАЕТ)" value={`$${stats.pending_payout_usd.toLocaleString("en-US")}`} accent="#f59e0b" />
        <Stat label="PAYOUT (ВЫПЛАЧЕНО)" value={`$${stats.paid_payout_usd.toLocaleString("en-US")}`} accent="#0f172a" />
      </section>

      {stats.clicks === 0 && (
        <div
          style={{
            padding: 18,
            background: "#fef3c7",
            border: "1px solid rgba(245,158,11,0.3)",
            borderRadius: 12,
            color: "#78350f",
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Трекинг ожидает первого клика</div>
          Метрики начнут обновляться автоматически после первого перехода по вашей ссылке.
          Cookie держится {stats.cookie_days} дней — даже если регистрация произойдёт через несколько недель,
          конверсия будет засчитана.
        </div>
      )}

      <section
        style={{
          padding: 22,
          background: "#fff",
          border: BORDER,
          borderRadius: 14,
          boxShadow: CARD,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.01em" }}>
          Как работает программа
        </h2>
        <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13, color: "#475569", lineHeight: 1.8 }}>
          <li>Делитесь реферальной ссылкой в любых каналах (блог, email, соцсети).</li>
          <li>Когда кто-то переходит — ставится cookie на {stats.cookie_days} дней.</li>
          <li>Если он/она оформит платную подписку — фиксируется конверсия.</li>
          <li>Каждый месяц получаете {stats.commission_percent}% от MRR этого клиента (lifetime, пока он подписчик).</li>
          <li>Минимум для payout — $50. Выплата через Stripe Connect раз в месяц.</li>
        </ol>
      </section>

      <section style={{ marginBottom: 56, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link
          href="/pricing/affiliate"
          style={{
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 10,
            background: "#fff",
            color: "#0f172a",
            border: BORDER,
            textDecoration: "none",
          }}
        >
          Документация программы
        </Link>
        <a
          href={`mailto:hello@aevion.io?subject=Affiliate%20${encodeURIComponent(application.email)}`}
          style={{
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 10,
            background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Связаться с менеджером
        </a>
      </section>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: "#fff", border: BORDER, borderRadius: 12, padding: 16, boxShadow: CARD }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#64748b", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[100, 140, 80, 120].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            background: "#f1f5f9",
            borderRadius: 12,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}
