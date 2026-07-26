"use client";

import { useState } from "react";
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
  const deal = listing.deal;
  const [intent] = useState<DealIntent>(deal?.intent ?? "raise");
  const [askUsd, setAskUsd] = useState(deal?.askUsd ? String(deal.askUsd) : "");
  const [equityPct, setEquityPct] = useState(deal?.equityOfferedPct ? String(deal.equityOfferedPct) : "");
  const [askingPrice, setAskingPrice] = useState(deal?.askingPriceUsd ? String(deal.askingPriceUsd) : "");
  const [stakePct, setStakePct] = useState(deal?.stakeForSalePct ? String(deal.stakeForSalePct) : "");
  const [stakePrice, setStakePrice] = useState(deal?.stakePriceUsd ? String(deal.stakePriceUsd) : "");
  const [notes, setNotes] = useState(deal?.notes ?? "");
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
        metrics: listing.metrics ?? undefined,
        demoUrl: listing.demo_url ?? undefined,
        repoUrl: listing.repo_url ?? undefined,
      });
      setSaved(true);
      onSaved(r.listing, r.assessment);
    } catch (e) {
      setIssues(e instanceof ApiError && e.issues.length ? e.issues : [{ field: "", message: "Не удалось сохранить условия." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 18 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Исправить условия</div>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
        {INTENT_LABEL[intent]}. Балл пересчитается сразу. Название и описание менять здесь нельзя:
        отпечаток авторства зафиксировал именно тот текст на дату подачи.
      </p>

      {intent === "raise" && (
        <div style={row}>
          <Field label="Сколько нужно, USD" value={askUsd} onChange={setAskUsd} />
          <Field label="Отдаёте долю, %" value={equityPct} onChange={setEquityPct} />
        </div>
      )}
      {intent === "sell_full" && <Field label="Цена продажи целиком, USD" value={askingPrice} onChange={setAskingPrice} />}
      {intent === "sell_stake" && (
        <div style={row}>
          <Field label="Размер доли, %" value={stakePct} onChange={setStakePct} />
          <Field label="Цена доли, USD" value={stakePrice} onChange={setStakePrice} />
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", margin: "4px 0" }}>Дополнительные условия</div>
      <textarea
        aria-label="Дополнительные условия"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        style={{ ...input, resize: "vertical" }}
        placeholder="Например: готов остаться в проекте на 6 месяцев после сделки"
      />

      {issues.length > 0 && (
        <ul style={{ margin: "6px 0 10px", paddingLeft: 18 }}>
          {issues.map((i, n) => (
            <li key={n} style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>{i.message}</li>
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
          {busy ? "Сохраняю…" : "Сохранить и пересчитать"}
        </button>
        {saved && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#166534" }}>Сохранено, балл обновлён</span>}
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
