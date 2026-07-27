"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { EditTermsForm } from "../../components/EditTermsForm";
import { AssessmentPanel } from "../../components/AssessmentPanel";
import { INTENT_LABEL, dealHeadline, labelOf, startupxApi, usd, type Listing, type Offer } from "../../lib";

/**
 * The founder's inbox for one listing.
 *
 * Opened with the token issued once at publish time — no account, no password.
 * That is the whole point: a founder should not have to register anywhere to
 * read the offers made on their own idea.
 */
export default function OffersPage() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = Number(params?.id);
  const token = search?.get("token") ?? "";

  const [data, setData] = useState<{ listing: Listing; offers: Offer[] } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied">("loading");
  // Withdrawal is irreversible from the founder's side of the screen, so it
  // takes two deliberate clicks rather than a modal nobody reads.
  const [confirming, setConfirming] = useState(false);
  const [withdrawn, setWithdrawn] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id <= 0 || !token) {
      setState("denied");
      return;
    }
    try {
      const fresh = await startupxApi.offers(id, token);
      setData(fresh);
      // Reloading the page must not offer to withdraw a listing that is already
      // withdrawn — the server state, not the click history, decides this.
      setWithdrawn(fresh.listing.visibility !== "public");
      setState("ready");
    } catch {
      setState("denied");
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function withdraw() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await startupxApi.withdraw(id, token);
      setWithdrawn(true);
    } catch {
      // The listing stays as it was; the founder can try again.
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading") {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <p style={{ color: "#64748b", padding: 40, textAlign: "center" }}>Открываю предложения…</p>
        </ProductPageShell>
      </>
    );
  }

  if (state === "denied" || !data) {
    return (
      <>
        <Wave1Nav />
        <ProductPageShell>
          <div style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
            <h1 style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>
              Ссылка не открывает эту заявку
            </h1>
            <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              Предложения видны только по личной ссылке, которую биржа выдала один раз — сразу после
              публикации заявки. Мы не храним её у себя: в базе лежит только отпечаток, поэтому
              восстановить ссылку нельзя даже нам. Если она потеряна, подайте заявку заново.
            </p>
            <Link href="/startup-exchange" style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
              ← К бирже
            </Link>
          </div>
        </ProductPageShell>
      </>
    );
  }

  const { listing, offers } = data;

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <Link
          href={`/startup-exchange/${listing.id}`}
          style={{ display: "inline-flex", alignItems: "center", minHeight: 36, padding: "6px 2px", fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}
        >
          ← К заявке
        </Link>

        <header style={{ margin: "14px 0 22px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            Предложения по «{listing.title}»
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "#64748b" }}>
            Вы просите: {dealHeadline(listing.deal)} · страницу открывали {listing.views ?? 0} раз ·
            предложений: {offers.length}
          </p>
          {/* Два нуля лечатся противоположным, и без этой строки основатель будет
              лечить не то: правит текст, когда его просто не видят, или гонит
              охват, когда проблема в цене. */}
          {(listing.views ?? 0) >= 20 && offers.length === 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#92400e", lineHeight: 1.55, maxWidth: 640 }}>
              Заявку смотрят, но не откликаются — значит вопрос не в охвате, а в том, что видит
              открывший: чаще всего это цена относительно рыночного диапазона или нераскрытые цифры.
              И то и другое правится здесь же, ниже.
            </p>
          )}
          {(listing.views ?? 0) < 5 && (
            <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "#64748b", lineHeight: 1.55, maxWidth: 640 }}>
              Показов пока почти нет — текст и цена тут ни при чём, вопрос в том, что ссылку никто
              не видел. Заявка уже в ленте и в поиске; дальше работает то, куда вы её отправите сами.
            </p>
          )}
        </header>

        {offers.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: 32, textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>○</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              Пока никто не откликнулся. Балл разбора и ясность описания вы можете улучшить сами —
              остальное решают время и охват.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {offers.map((o) => {
              const implied =
                o.ticketUsd && o.equityPct ? Math.round(o.ticketUsd / (o.equityPct / 100)) : null;
              return (
                <article key={o.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
                        {o.ticketUsd ? usd(o.ticketUsd) : "Чек не назван"}
                        {o.equityPct ? <span style={{ color: "#475569", fontWeight: 700 }}> за {o.equityPct}%</span> : null}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                        {labelOf(INTENT_LABEL, o.intent, "Тип сделки не указан")}
                        {/* Не «оценка» — это арифметика самого инвестора: чек делить
                            на предложенную долю. Мы проект не оцениваем и говорим это
                            на каждом экране, значит и подпись должна называть вещи так. */}
                        {implied !== null && ` · по его условиям — ${usd(implied)} за всё`}
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#64748b", textAlign: "right" }}>
                      {new Date(o.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>

                  {o.message && (
                    <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {o.message}
                    </p>
                  )}

                  {/* Главное действие кабинета. Замерено 27.07.2026: ссылка была
                      высотой 17px — на телефоне это промах пальцем, а промахнуться
                      здесь значит не ответить инвестору. Кнопочная зона нажатия. */}
                  <a
                    href={`mailto:${o.investorEmail}?subject=${encodeURIComponent(`Re: ${listing.title}`)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      minHeight: 40,
                      padding: "8px 14px",
                      borderRadius: 9,
                      border: "1px solid #ddd6fe",
                      background: "#f5f3ff",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#6d28d9",
                      textDecoration: "none",
                    }}
                  >
                    Ответить: {o.investorEmail} ↗
                  </a>
                </article>
              );
            })}
          </div>
        )}

        {listing.removed_reason && (
          <div style={{ marginTop: 22, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#991b1b", marginBottom: 4 }}>
              Заявка снята площадкой
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#7f1d1d", lineHeight: 1.6 }}>
              Причина: {listing.removed_reason}. Эта страница и полученные предложения остаются у вас,
              но в ленте заявки больше нет, и вернуть её кнопкой нельзя — сначала нужно устранить
              причину и написать нам.
            </p>
          </div>
        )}

        {!withdrawn && !listing.removed_reason && (
          <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
            <EditTermsForm
              listing={listing}
              token={token}
              onSaved={(updated, assessment) =>
                setData((prev) => (prev ? { ...prev, listing: { ...updated, assessment } } : prev))
              }
            />
            {listing.assessment && <AssessmentPanel a={listing.assessment} compact />}
          </div>
        )}

        <div style={{ marginTop: 26, paddingTop: 18, borderTop: "1px solid #e2e8f0" }}>
          {listing.qright_protected && (
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              Нашли инвестора или передумали? Снимите заявку — она исчезнет из ленты, но запись и
              полученные предложения останутся у вас, вместе с отпечатком авторства на дату подачи.
            </p>
          )}
          {withdrawn ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
              Заявка снята с публикации. Эта страница по-прежнему открывается по вашей ссылке.
            </div>
          ) : (
            <button
              type="button"
              onClick={withdraw}
              disabled={busy}
              style={{
                padding: "9px 16px",
                borderRadius: 9,
                border: "1px solid #fecaca",
                background: "#fff",
                color: "#991b1b",
                fontWeight: 700,
                fontSize: 13,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {confirming ? "Точно снять? Нажмите ещё раз" : "Снять заявку с публикации"}
            </button>
          )}
        </div>

        <p style={{ margin: "22px 0 0", fontSize: 11.5, color: "#64748b", lineHeight: 1.6, maxWidth: 640 }}>
          Отклик — заявка на разговор с названными условиями, а не оферта и не обязательство ни для
          одной из сторон. Проверять инвестора, обсуждать цену и оформлять сделку вы будете сами;
          биржа в этом не участвует и денег не держит.
        </p>
      </ProductPageShell>
    </>
  );
}
