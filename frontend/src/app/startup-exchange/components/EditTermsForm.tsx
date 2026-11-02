"use client";

import { useState } from "react";
import { useSxLang } from "../useSxLang";
import { sx } from "../sxText";
import { SX_BUSY } from "./busyUi";
import {
  ApiError,
  INTENT_LABEL,
  startupxApi,
  type Assessment,
  type DealIntent,
  type Listing,
  type ValidationIssue,
} from "../lib";

/**
 * Correcting the terms of a published listing.
 *
 * This sits on the founder's own page because that is where the token is, and
 * next to the analysis because that is what prompts the edit: the score says
 * the ask is above market, and the fix has to be one click away rather than
 * "withdraw and start over".
 *
 * The pitch itself is not editable here — the authorship stamp covers that
 * text on that date. The form says so instead of hiding the fields.
 */
export function EditTermsForm({
  listing,
  token,
  onSaved,
}: {
  listing: Listing;
  token: string;
  onSaved: (listing: Listing, assessment: Assessment) => void;
}) {
  const sxLang = useSxLang();
  const SX = SX_BUSY[sxLang] ?? SX_BUSY.en;
  const t = (s: string, v?: Record<string, string | number>) => sx(sxLang, s, v);
  const deal = listing.deal;
  const [intent] = useState<DealIntent>(deal?.intent ?? "raise");
  const [askUsd, setAskUsd] = useState(deal?.askUsd ? String(deal.askUsd) : "");
  const [equityPct, setEquityPct] = useState(deal?.equityOfferedPct ? String(deal.equityOfferedPct) : "");
  const [askingPrice, setAskingPrice] = useState(deal?.askingPriceUsd ? String(deal.askingPriceUsd) : "");
  const [stakePct, setStakePct] = useState(deal?.stakeForSalePct ? String(deal.stakeForSalePct) : "");
  const [stakePrice, setStakePrice] = useState(deal?.stakePriceUsd ? String(deal.stakePriceUsd) : "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
  // Цифры правятся здесь же по прямой причине: разбор говорит «балл поднимут
  // раскрытые цифры, а не текст», а показать их основателю было негде — он
  // видел совет и не мог ему последовать.
  const m = listing.metrics;
  const [mrr, setMrr] = useState(m?.mrrUsd ? String(m.mrrUsd) : "");
  const [arr, setArr] = useState(m?.arrUsd ? String(m.arrUsd) : "");
  const [users, setUsers] = useState(m?.users ? String(m.users) : "");
  const [paying, setPaying] = useState(m?.payingCustomers ? String(m.payingCustomers) : "");
  const [growth, setGrowth] = useState(m?.growthMomPct ? String(m.growthMomPct) : "");
  const [churn, setChurn] = useState(m?.churnMonthlyPct ? String(m.churnMonthlyPct) : "");
  const [margin, setMargin] = useState(m?.grossMarginPct ? String(m.grossMarginPct) : "");
  const [team, setTeam] = useState(m?.teamSize ? String(m.teamSize) : "");
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [saved, setSaved] = useState(false);

  const num = (v: string): number | undefined => {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  async function save() {
    setBusy(true);
    setIssues([]);
    setSaved(false);
    try {
      const r = await startupxApi.updateTerms(listing.id, token, {
        deal: {
          intent,
          askUsd: num(askUsd),
          equityOfferedPct: num(equityPct),
          buildBy: deal?.buildBy,
          askingPriceUsd: num(askingPrice),
          stakeForSalePct: num(stakePct),
          stakePriceUsd: num(stakePrice),
          notes: notes.trim() || undefined,
        },
        metrics: {
          mrrUsd: num(mrr),
          arrUsd: num(arr),
          users: num(users),
          payingCustomers: num(paying),
          growthMomPct: num(growth),
          churnMonthlyPct: num(churn),
          grossMarginPct: num(margin),
          teamSize: num(team),
          monthsInDevelopment: listing.metrics?.monthsInDevelopment,
        },
        demoUrl: listing.demo_url ?? undefined,
        repoUrl: listing.repo_url ?? undefined,
      });
      setSaved(true);
      onSaved(r.listing, r.assessment);
    } catch (e) {
      setIssues(e instanceof ApiError && e.issues.length ? e.issues : [{ field: "", message: t("Не удалось сохранить условия.") }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{t("Исправить условия")}</div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
        {t(INTENT_LABEL[intent])}. {t("Балл пересчитается сразу. Название и описание менять здесь нельзя: отпечаток авторства зафиксировал именно тот текст на дату подачи.")}
      </p>

      {intent === "raise" && (
        <div style={row}>
          <Field label={t("Сколько нужно, USD")} value={askUsd} onChange={setAskUsd} />
          <Field label={t("Отдаёте долю, %")} value={equityPct} onChange={setEquityPct} />
        </div>
      )}
      {intent === "sell_full" && <Field label={t("Цена продажи целиком, USD")} value={askingPrice} onChange={setAskingPrice} />}
      {intent === "sell_stake" && (
        <div style={row}>
          <Field label={t("Размер доли, %")} value={stakePct} onChange={setStakePct} />
          <Field label={t("Цена доли, USD")} value={stakePrice} onChange={setStakePrice} />
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "4px 0" }}>{t("Дополнительные условия")}</div>
      <textarea
        aria-label={t("Дополнительные условия")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        style={{ ...input, resize: "vertical" }}
        placeholder={t("Например: готов остаться в проекте на 6 месяцев после сделки")}
      />

      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", margin: "18px 0 4px" }}>{t("Цифры проекта")}</div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
        {t("Именно они переводят балл с «по отрасли» на «по данным заявки» — и именно их просит разбор. Заполняйте только то, что можете показать: биржа цифры не проверяет и честно об этом пишет, но сверяет их между собой.")}
      </p>
      <div style={row}>
        <Field label={t("MRR, USD")} value={mrr} onChange={setMrr} />
        <Field label={t("ARR, USD")} value={arr} onChange={setArr} />
      </div>
      <div style={row}>
        <Field label={t("Пользователей")} value={users} onChange={setUsers} />
        <Field label={t("Платящих клиентов")} value={paying} onChange={setPaying} />
      </div>
      <div style={row}>
        <Field label={t("Рост, %/мес")} value={growth} onChange={setGrowth} />
        <Field label={t("Отток, %/мес")} value={churn} onChange={setChurn} />
      </div>
      <div style={row}>
        <Field label={t("Валовая маржа, %")} value={margin} onChange={setMargin} />
        <Field label={t("Команда, человек")} value={team} onChange={setTeam} />
      </div>

      {issues.length > 0 && (
        <ul style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
          {issues.map((i, n) => (
            <li key={n} style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>{t(i.message)}</li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          style={{
            padding: "9px 18px",
            borderRadius: 9,
            border: "none",
            background: busy ? "#64748b" : "#0f172a",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? SX.saving : t("Сохранить и пересчитать")}
        </button>
        {saved && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>{t("Сохранено, балл обновлён")}</span>}
      </div>
    </div>
  );
}

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 10,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid #e2e8f0",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "#0f172a",
  marginBottom: 10,
  boxSizing: "border-box",
};

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{label}</div>
      {/* Видимая подпись — обычный div, программно с полем не связана; без
          aria-label читалка объявляет безымянное поле ввода. */}
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={input} inputMode="decimal" />
    </div>
  );
}
