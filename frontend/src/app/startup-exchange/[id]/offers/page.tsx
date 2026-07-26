"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { INTENT_LABEL, dealHeadline, startupxApi, usd, type Listing, type Offer } from "../../lib";

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
          <p style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Открываю предложения…</p>
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
        <Link href={`/startup-exchange/${listing.id}`} style={{ fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 600 }}>
          ← К заявке
        </Link>

        <header style={{ margin: "14px 0 22px" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            Предложения по «{listing.title}»
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: "#64748b" }}>
            Вы просите: {dealHeadline(listing.deal)} · всего откликов: {offers.length}
          </p>
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
                        {o.intent ? INTENT_LABEL[o.intent] : "Тип сделки не указан"}
                        {implied !== null && ` · это оценка ${usd(implied)}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#94a3b8", textAlign: "right" }}>
                      {new Date(o.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>

                  {o.message && (
                    <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                      {o.message}
                    </p>
                  )}

                  <a
                    href={`mailto:${o.investorEmail}?subject=${encodeURIComponent(`Re: ${listing.title}`)}`}
                    style={{ fontSize: 13, fontWeight: 700, color: "#7c3aed", textDecoration: "none" }}
                  >
                    Ответить: {o.investorEmail} ↗
                  </a>
                </article>
              );
            })}
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

        <p style={{ margin: "22px 0 0", fontSize: 11.5, color: "#94a3b8", lineHeight: 1.6, maxWidth: 640 }}>
          Отклик — заявка на разговор с названными условиями, а не оферта и не обязательство ни для
          одной из сторон. Проверять инвестора, обсуждать цену и оформлять сделку вы будете сами;
          биржа в этом не участвует и денег не держит.
        </p>
      </ProductPageShell>
    </>
  );
}
