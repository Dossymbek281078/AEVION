"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { AssessmentPanel } from "../components/AssessmentPanel";
import { Toast } from "../components/Toast";
import { InterestModal } from "../components/InterestModal";
import {
  BUILD_BY_LABEL,
  INTENT_LABEL,
  TIER_ACCENT,
  dealHeadline,
  startupxApi,
  usd,
  type Listing,
} from "../lib";

/**
 * A single listing, in full. This is the link a founder sends to an investor,
 * so it has to stand alone: terms, numbers, the free assessment and what the
 * assessment could not see, all on one page.
 */
export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [listing, setListing] = useState<Listing | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [showInterest, setShowInterest] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0) {
      setState("missing");
      return;
    }
    try {
      setListing(await startupxApi.get(id));
      setState("ready");
    } catch {
      setState("missing");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === "loading") {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <p style={{ color: "#64748b", padding: 40, textAlign: "center" }}>Загружаю заявку…</p>
        </ProductPageShell>
      </>
    );
  }

  if (state === "missing" || !listing) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ padding: 40, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>Заявка не найдена</h1>
            <p style={{ color: "#64748b", fontSize: 14 }}>Возможно, она снята с публикации.</p>
            <Link href="/startup-exchange" style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
              ← Ко всем заявкам
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const accent = TIER_ACCENT[listing.tier];
  const deal = listing.deal;
  const m = listing.metrics;
  const metricRows: Array<[string, string]> = [];
  if (m?.mrrUsd) metricRows.push(["MRR", usd(m.mrrUsd)]);
  if (m?.arrUsd) metricRows.push(["ARR", usd(m.arrUsd)]);
  if (m?.users) metricRows.push(["Пользователи", String(m.users)]);
  if (m?.payingCustomers) metricRows.push(["Платящие клиенты", String(m.payingCustomers)]);
  if (m?.growthMomPct) metricRows.push(["Рост", `${m.growthMomPct}%/мес`]);
  if (m?.churnMonthlyPct) metricRows.push(["Отток", `${m.churnMonthlyPct}%/мес`]);
  if (m?.grossMarginPct) metricRows.push(["Валовая маржа", `${m.grossMarginPct}%`]);
  if (m?.teamSize) metricRows.push(["Команда", `${m.teamSize} чел.`]);
  if (m?.monthsInDevelopment) metricRows.push(["В разработке", `${m.monthsInDevelopment} мес.`]);

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <Link href="/startup-exchange" style={{ fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
          ← Все заявки
        </Link>

        <header style={{ margin: "14px 0 20px" }}>
          <span style={{ padding: "3px 10px", borderRadius: 20, background: `${accent}14`, color: accent, fontSize: 11, fontWeight: 800 }}>
            {listing.tierLabel}
          </span>
          <h1 style={{ margin: "10px 0 8px", fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1.25 }}>
            {listing.title}
          </h1>
          <div style={{ fontSize: 16, fontWeight: 700, color: accent }}>{dealHeadline(deal)}</div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 6 }}>
            Опубликовано {new Date(listing.created_at).toLocaleDateString("ru-RU")}
            {listing.geography && ` · ${listing.geography}`}
            {listing.interest_count !== undefined && ` · откликов: ${listing.interest_count}`}
          </div>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 22, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Описание</h2>
              <p style={{ margin: 0, fontSize: 14, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {listing.description}
              </p>
              {(listing.demo_url || listing.repo_url) && (
                <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
                  {listing.demo_url && (
                    <a href={listing.demo_url} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                      Открыть продукт ↗
                    </a>
                  )}
                  {listing.repo_url && (
                    <a href={listing.repo_url} target="_blank" rel="noopener noreferrer" style={linkBtn}>
                      Репозиторий ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            {listing.assessment ? (
              <AssessmentPanel a={listing.assessment} />
            ) : (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 20, fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>
                Эта заявка подана до появления разбора, поэтому балла у неё нет. Оценка не додумывается
                задним числом: чтобы она появилась, основателю нужно указать условия сделки.
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside style={{ position: "sticky", top: 20, display: "grid", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Условия сделки</h3>
              {deal ? (
                <dl style={{ margin: 0, display: "grid", gap: 8 }}>
                  <Row k="Тип" v={INTENT_LABEL[deal.intent]} />
                  {deal.askUsd !== undefined && <Row k="Нужно денег" v={usd(deal.askUsd)} />}
                  {deal.equityOfferedPct !== undefined && <Row k="Отдают долю" v={`${deal.equityOfferedPct}%`} />}
                  {deal.buildBy && <Row k="Кто доводит" v={BUILD_BY_LABEL[deal.buildBy]} />}
                  {deal.askingPriceUsd !== undefined && <Row k="Цена целиком" v={usd(deal.askingPriceUsd)} />}
                  {deal.stakeForSalePct !== undefined && <Row k="Доля на продажу" v={`${deal.stakeForSalePct}%`} />}
                  {deal.stakePriceUsd !== undefined && <Row k="Цена доли" v={usd(deal.stakePriceUsd)} />}
                  {deal.notes && (
                    <div style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.55, borderTop: "1px solid #f1f5f9", paddingTop: 8 }}>
                      {deal.notes}
                    </div>
                  )}
                </dl>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>Основатель не указал условия.</p>
              )}
              <button
                type="button"
                onClick={() => setShowInterest(true)}
                style={{ width: "100%", marginTop: 14, padding: "11px 14px", borderRadius: 10, border: "none", background: "#0f172a", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
              >
                Предложить сделку
              </button>
              {listing.contact_method && (
                <p style={{ margin: "8px 0 0", fontSize: 11.5, color: "#64748b" }}>
                  Публичный контакт: {listing.contact_method}
                </p>
              )}
            </div>

            {metricRows.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 18 }}>
                <h3 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Цифры от основателя</h3>
                <dl style={{ margin: 0, display: "grid", gap: 8 }}>
                  {metricRows.map(([k, v]) => (
                    <Row key={k} k={k} v={v} />
                  ))}
                </dl>
                <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                  Указаны основателем. Биржа их не проверяла.
                </p>
              </div>
            )}

            {/* Пожаловаться можно с самой заявки: жалоба, до которой надо
                догадаться, не поступит никогда. Ничего не скрывает — только
                показывает оператору, куда смотреть. */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
              {reporting ? (
                <div style={{ fontSize: 12.5, color: "#166534", fontWeight: 700 }}>
                  Жалоба принята — оператор посмотрит заявку.
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 8, lineHeight: 1.5 }}>
                    Заявка выглядит мусором, обманом или чужой работой?
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {([
                      ["spam", "Спам"],
                      ["scam", "Обман"],
                      ["stolen", "Чужая работа"],
                      ["illegal", "Незаконное"],
                    ] as const).map(([reason, label]) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          startupxApi.report(listing.id, { reason }).catch(() => {});
                          setReporting(true);
                        }}
                        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {listing.qright_protected && listing.content_hash && (
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 800, color: "#0f172a" }}>Отпечаток заявки</h3>
                <code style={{ fontSize: 10.5, color: "#475569", wordBreak: "break-all", lineHeight: 1.5, display: "block" }}>
                  sha256:{listing.content_hash}
                </code>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
                  SHA-256 от текста заявки на дату подачи — та же схема, что в QRight.
                </p>
              </div>
            )}
          </aside>
        </div>
      </ProductPageShell>

      {showInterest && (
        <InterestModal
          listing={listing}
          onClose={() => setShowInterest(false)}
          onSubmitted={() => {
            setShowInterest(false);
            setToast("Предложение отправлено основателю");
            load();
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5 }}>
      <dt style={{ color: "#64748b" }}>{k}</dt>
      <dd style={{ margin: 0, color: "#0f172a", fontWeight: 700, textAlign: "right" }}>{v}</dd>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#7c3aed",
  textDecoration: "none",
};
