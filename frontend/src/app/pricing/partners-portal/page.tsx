"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { track } from "@/lib/track";

interface PartnerApplication {
  id: string;
  ts: string;
  name: string;
  email: string;
  organization: string | null;
  country: string | null;
  partnerType: string | null;
  status: string;
}

interface PartnerDeal {
  id: string;
  ts: string;
  partnerEmail: string;
  customer: string;
  customerEmail?: string;
  modules: string[];
  dealSizeUsd: number;
  expectedClose?: string;
  notes?: string;
  status: "registered" | "qualified" | "won" | "lost";
}

interface PortalPayload {
  application: PartnerApplication;
  deals: PartnerDeal[];
  totals: {
    count: number;
    pipeline_usd: number;
    won_usd: number;
    lost_usd: number;
  };
  margin_percent: number;
}

const CARD = "0 4px 20px rgba(15,23,42,0.06)";
const BORDER = "1px solid rgba(15,23,42,0.08)";

const MODULE_OPTIONS = [
  "qsign",
  "qright",
  "qcoreai",
  "qtrade",
  "quantum-shield",
  "aevion-ip-bureau",
  "cyberchess",
  "bank",
  "multichat-engine",
  "planet",
];

const STATUS_META: Record<PartnerDeal["status"], { label: string; bg: string; fg: string }> = {
  registered: { label: "REGISTERED", bg: "#dbeafe", fg: "#1e40af" },
  qualified: { label: "QUALIFIED", bg: "#fef3c7", fg: "#92400e" },
  won: { label: "WON", bg: "#d1fae5", fg: "#065f46" },
  lost: { label: "LOST", bg: "#fee2e2", fg: "#991b1b" },
};

export default function PartnersPortalPage() {
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

  const [data, setData] = useState<PortalPayload | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [showDealForm, setShowDealForm] = useState(false);
  const [dealStatus, setDealStatus] = useState<"idle" | "submitting" | "ok" | "err">("idle");
  const [dealError, setDealError] = useState<string | null>(null);

  useEffect(() => {
    track({ type: "page_view", source: "pricing/partners-portal" });
  }, []);

  async function load() {
    setLoadingDash(true);
    setError(null);
    try {
      const r = await fetch(
        apiUrl("/api/pricing/partners/dashboard") +
          `?email=${encodeURIComponent(emailFromUrl)}&token=${encodeURIComponent(tokenFromUrl)}`,
      );
      if (r.status === 401) throw new Error("Ссылка устарела или некорректна");
      if (r.status === 404) throw new Error("Заявка не найдена. Сначала подайте на /pricing/partners.");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as PortalPayload;
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingDash(false);
    }
  }

  useEffect(() => {
    if (!emailFromUrl || !tokenFromUrl) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromUrl, tokenFromUrl]);

  async function requestMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setLinkSubmitting(true);
    setLinkError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/partners/magic-link"), {
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

  async function submitDeal(form: HTMLFormElement) {
    const fd = new FormData(form);
    const customer = String(fd.get("customer") ?? "").trim();
    const customerEmail = String(fd.get("customerEmail") ?? "").trim() || undefined;
    const dealSizeUsd = parseInt(String(fd.get("dealSizeUsd") ?? "0"), 10);
    const expectedClose = String(fd.get("expectedClose") ?? "").trim() || undefined;
    const notes = String(fd.get("notes") ?? "").trim() || undefined;
    const modules = MODULE_OPTIONS.filter((m) => fd.get(`mod_${m}`) === "on");

    if (!customer) {
      setDealError("Укажите имя клиента");
      setDealStatus("err");
      return;
    }
    if (modules.length === 0) {
      setDealError("Выберите хотя бы один модуль");
      setDealStatus("err");
      return;
    }

    setDealStatus("submitting");
    setDealError(null);
    try {
      const r = await fetch(apiUrl("/api/pricing/partners/deals"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailFromUrl,
          token: tokenFromUrl,
          customer,
          customerEmail,
          modules,
          dealSizeUsd: Number.isFinite(dealSizeUsd) ? dealSizeUsd : 0,
          expectedClose,
          notes,
        }),
      });
      if (r.status === 401) throw new Error("Сессия истекла. Запросите новый magic-link.");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setDealStatus("ok");
      form.reset();
      setShowDealForm(false);
      await load();
    } catch (err) {
      setDealError(err instanceof Error ? err.message : String(err));
      setDealStatus("err");
    }
  }

  if (emailFromUrl && tokenFromUrl) {
    return (
      <ProductPageShell maxWidth={1000}>
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <Link href="/pricing/partners" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            ← Partner program
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
              <Link href="/pricing/partners-portal" style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textDecoration: "none" }}>
                ← Запросить новый magic-link
              </Link>
            </div>
          </div>
        )}
        {data && (
          <PortalContent
            data={data}
            showDealForm={showDealForm}
            onToggleForm={() => setShowDealForm((s) => !s)}
            onSubmitDeal={submitDeal}
            dealStatus={dealStatus}
            dealError={dealError}
          />
        )}
      </ProductPageShell>
    );
  }

  return (
    <ProductPageShell maxWidth={520}>
      <div style={{ marginTop: 24, marginBottom: 16 }}>
        <Link href="/pricing/partners" style={{ color: "#64748b", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          ← Partner program
        </Link>
      </div>

      <section style={{ textAlign: "center", padding: "12px 0 28px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "linear-gradient(135deg, #7c3aed, #ec4899)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            borderRadius: 999,
            marginBottom: 16,
          }}
        >
          PARTNERS PORTAL
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.025em" }}>
          Войти в partner-портал
        </h1>
        <p style={{ fontSize: 14, color: "#475569", maxWidth: 440, margin: "0 auto", lineHeight: 1.5 }}>
          Введите email с которым вы подавали заявку. Мы отправим magic-link на ваш ящик.
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
            Если email есть в системе — magic-link будет в вашем ящике через минуту.
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
              background: linkSubmitting || !emailInput.trim() ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #ec4899)",
              color: "#fff",
            }}
          >
            {linkSubmitting ? "Отправка…" : "Прислать ссылку"}
          </button>
          <div style={{ marginTop: 14, fontSize: 12, color: "#64748b", textAlign: "center" }}>
            Ещё нет заявки?{" "}
            <Link href="/pricing/partners" style={{ color: "#0d9488", fontWeight: 700, textDecoration: "none" }}>
              Подать на /pricing/partners →
            </Link>
          </div>
        </form>
      )}
    </ProductPageShell>
  );
}

function PortalContent({
  data,
  showDealForm,
  onToggleForm,
  onSubmitDeal,
  dealStatus,
  dealError,
}: {
  data: PortalPayload;
  showDealForm: boolean;
  onToggleForm: () => void;
  onSubmitDeal: (form: HTMLFormElement) => void;
  dealStatus: "idle" | "submitting" | "ok" | "err";
  dealError: string | null;
}) {
  const { application, deals, totals, margin_percent } = data;

  return (
    <>
      <section style={{ marginBottom: 24, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#7c3aed", letterSpacing: "0.06em", marginBottom: 4 }}>
            PARTNER PORTAL
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
            {application.organization ?? application.name}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748b" }}>
            {application.partnerType ? `${application.partnerType} · ` : ""}
            заявка #{application.id} · {new Date(application.ts).toLocaleDateString("ru-RU")} · margin {margin_percent}%
          </p>
        </div>
        <button
          onClick={onToggleForm}
          style={{
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 800,
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: showDealForm ? "#fff" : "linear-gradient(135deg, #7c3aed, #ec4899)",
            color: showDealForm ? "#0f172a" : "#fff",
            ...(showDealForm ? { boxShadow: CARD, border: BORDER } : {}),
          }}
        >
          {showDealForm ? "Скрыть форму" : "+ Зарегистрировать сделку"}
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Stat label="ВСЕГО СДЕЛОК" value={totals.count.toString()} accent="#0f172a" />
        <Stat label="PIPELINE" value={`$${totals.pipeline_usd.toLocaleString("en-US")}`} accent="#0ea5e9" />
        <Stat label="WON" value={`$${totals.won_usd.toLocaleString("en-US")}`} accent="#0d9488" />
        <Stat label="LOST" value={`$${totals.lost_usd.toLocaleString("en-US")}`} accent="#dc2626" />
      </section>

      {showDealForm && (
        <section
          style={{
            background: "#fff",
            border: BORDER,
            borderRadius: 14,
            padding: 22,
            boxShadow: CARD,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, marginBottom: 14, letterSpacing: "-0.01em" }}>
            Регистрация сделки
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitDeal(e.currentTarget);
            }}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <Field label="Клиент *">
              <input name="customer" required type="text" placeholder="ООО «Пример»" style={inputStyle} />
            </Field>
            <Field label="Email клиента (опционально)">
              <input name="customerEmail" type="email" placeholder="contact@example.com" style={inputStyle} />
            </Field>
            <Field label="Размер сделки (USD)">
              <input name="dealSizeUsd" type="number" min="0" step="100" placeholder="50000" style={inputStyle} />
            </Field>
            <Field label="Ожидаемое закрытие">
              <input name="expectedClose" type="date" style={inputStyle} />
            </Field>
            <Field label="Модули AEVION *">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                {MODULE_OPTIONS.map((m) => (
                  <label
                    key={m}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      border: BORDER,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" name={`mod_${m}`} />
                    <span style={{ fontFamily: "ui-monospace, monospace" }}>{m}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Заметки">
              <textarea name="notes" rows={4} placeholder="Контекст сделки, decision-makers, конкуренты, риски" style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }} />
            </Field>
            {dealError && (
              <div style={{ padding: 10, background: "#fef2f2", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#991b1b", fontSize: 12 }}>
                {dealError}
              </div>
            )}
            <button
              type="submit"
              disabled={dealStatus === "submitting"}
              style={{
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: 800,
                borderRadius: 10,
                border: "none",
                cursor: dealStatus === "submitting" ? "wait" : "pointer",
                background: dealStatus === "submitting" ? "#94a3b8" : "linear-gradient(135deg, #7c3aed, #ec4899)",
                color: "#fff",
              }}
            >
              {dealStatus === "submitting" ? "Регистрация…" : "Зарегистрировать сделку"}
            </button>
          </form>
        </section>
      )}

      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, marginBottom: 12, letterSpacing: "-0.01em" }}>
          Мои сделки
        </h2>
        {deals.length === 0 ? (
          <div
            style={{
              padding: 28,
              background: "#f8fafc",
              border: BORDER,
              borderRadius: 12,
              textAlign: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            Сделок пока нет. Зарегистрируйте первую — это закрепляет клиента за вами на 90 дней.
          </div>
        ) : (
          <div style={{ background: "#fff", border: BORDER, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={th}>Клиент</th>
                    <th style={th}>Модули</th>
                    <th style={th}>Сумма</th>
                    <th style={th}>Закрытие</th>
                    <th style={th}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((d, i) => {
                    const meta = STATUS_META[d.status];
                    return (
                      <tr key={d.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(15,23,42,0.05)" }}>
                        <td style={td}>
                          <div style={{ fontWeight: 700 }}>{d.customer}</div>
                          {d.customerEmail && (
                            <div style={{ fontSize: 11, color: "#64748b", fontFamily: "ui-monospace, monospace" }}>{d.customerEmail}</div>
                          )}
                        </td>
                        <td style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#475569" }}>
                          {d.modules.join(", ")}
                        </td>
                        <td style={{ ...td, fontWeight: 800 }}>${d.dealSizeUsd.toLocaleString("en-US")}</td>
                        <td style={td}>{d.expectedClose ?? "—"}</td>
                        <td style={td}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", background: meta.bg, color: meta.fg, borderRadius: 999, letterSpacing: "0.04em" }}>
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[80, 100, 220].map((h, i) => (
        <div
          key={i}
          style={{
            height: h,
            background: "#f1f5f9",
            borderRadius: 12,
          }}
        />
      ))}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 13,
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.12)",
  boxSizing: "border-box",
};

const th: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontWeight: 800,
  color: "#475569",
  fontSize: 11,
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "10px 14px",
  color: "#0f172a",
  whiteSpace: "nowrap",
};
