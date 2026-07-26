"use client";

import { useState } from "react";
import {
  ApiError,
  BUILD_BY_LABEL,
  INTENT_LABEL,
  TIER_ACCENT,
  startupxApi,
  usd,
  type Assessment,
  type BuildBy,
  type DealIntent,
  type Listing,
  type ListingDraft,
  type Tier,
  type TierSpec,
  type ValidationIssue,
} from "../lib";
import { AssessmentPanel } from "./AssessmentPanel";

/**
 * Submitting a listing, prompt-first.
 *
 * The founder writes what they are building and gets the analysis for free,
 * before deciding anything else — no account, no terms, no publishing. Terms
 * come second, when they can already see what an investor will see.
 */

type Phase = "draft" | "terms";

interface Props {
  tiers: TierSpec[];
  sectors: Array<{ id: string; label: string }>;
  onPublished: (listing: Listing) => void;
}

const NUM = (v: string): number | undefined => {
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function ListingWizard({ tiers, sectors, onPublished }: Props) {
  const [phase, setPhase] = useState<Phase>("draft");
  const [tier, setTier] = useState<Tier>("idea");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [geography, setGeography] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const [intent, setIntent] = useState<DealIntent>("raise");
  const [askUsd, setAskUsd] = useState("");
  const [equityPct, setEquityPct] = useState("");
  const [buildBy, setBuildBy] = useState<BuildBy>("founder");
  const [askingPrice, setAskingPrice] = useState("");
  const [stakePct, setStakePct] = useState("");
  const [stakePrice, setStakePrice] = useState("");
  const [notes, setNotes] = useState("");

  const [mrr, setMrr] = useState("");
  const [users, setUsers] = useState("");
  const [growth, setGrowth] = useState("");
  const [teamSize, setTeamSize] = useState("");

  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  const spec = tiers.find((t) => t.id === tier);
  const allowedIntents = spec?.intents ?? ["raise"];
  const effectiveIntent = allowedIntents.includes(intent) ? intent : allowedIntents[0];

  function buildDraft(): ListingDraft {
    return {
      title: title.trim() || "Без названия",
      description: description.trim(),
      tier,
      sector: sector || undefined,
      geography: geography.trim() || undefined,
      demoUrl: demoUrl.trim() || undefined,
      repoUrl: repoUrl.trim() || undefined,
      deal: {
        intent: effectiveIntent,
        askUsd: NUM(askUsd),
        equityOfferedPct: NUM(equityPct),
        buildBy,
        askingPriceUsd: NUM(askingPrice),
        stakeForSalePct: NUM(stakePct),
        stakePriceUsd: NUM(stakePrice),
        notes: notes.trim() || undefined,
      },
      metrics: {
        mrrUsd: NUM(mrr),
        users: NUM(users),
        growthMomPct: NUM(growth),
        teamSize: NUM(teamSize),
      },
      founderEmail: email.trim() || undefined,
      contactMethod: contact.trim() || undefined,
    };
  }

  async function runAssessment(next: Phase) {
    setBusy(true);
    setIssues([]);
    setError(null);
    try {
      const r = await startupxApi.assess(buildDraft());
      setAssessment(r.assessment);
      setPhase(next);
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(e.issues);
        if (e.issues.length === 0) setError(e.message);
      } else {
        setError("Не удалось получить анализ. Проверьте связь и попробуйте ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setIssues([]);
    setError(null);
    try {
      const r = await startupxApi.publish(buildDraft());
      onPublished(r.listing);
      setAssessment(r.assessment);
    } catch (e) {
      if (e instanceof ApiError) {
        setIssues(e.issues);
        if (e.issues.length === 0) setError(e.message);
      } else {
        setError("Не удалось опубликовать. Попробуйте ещё раз.");
      }
    } finally {
      setBusy(false);
    }
  }

  const issueFor = (field: string) => issues.find((i) => i.field === field)?.message;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Tier choice ───────────────────────────────────────────────────── */}
      <div style={card}>
        <Label>Что вы выставляете</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 10 }}>
          {tiers.map((t) => {
            const active = t.id === tier;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTier(t.id)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${active ? TIER_ACCENT[t.id] : "#e2e8f0"}`,
                  background: active ? "#fff" : "#fcfcfd",
                  cursor: "pointer",
                  boxShadow: active ? `0 0 0 3px ${TIER_ACCENT[t.id]}1a` : "none",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: active ? TIER_ACCENT[t.id] : "#0f172a" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.45, marginTop: 4 }}>{t.offer}</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                  Типичный чек: {usd(t.ticketUsd.low)} – {usd(t.ticketUsd.high)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Prompt ────────────────────────────────────────────────────────── */}
      <div style={card}>
        <Label>Опишите — остальное сделаю я</Label>
        <p style={{ margin: "6px 0 12px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
          Своими словами: какую проблему решаете, для кого, как это работает и на чём зарабатываете.
          Анализ будет бесплатным и сразу — ни аккаунта, ни условий сделки на этом шаге не нужно.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название проекта"
          style={input}
        />
        <FieldError message={issueFor("title")} />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`Например: мелкие перевозчики ищут обратный груз вручную в чатах и теряют треть рейсов на пустом пробеге. Мы подбираем груз автоматически по маршруту освободившейся машины. Берём 5% комиссии с рейса.`}
          rows={7}
          style={{ ...input, resize: "vertical", lineHeight: 1.55, minHeight: 150 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: -4 }}>
          <span>{issueFor("description") ? <span style={{ color: "#dc2626" }}>{issueFor("description")}</span> : "Чем конкретнее, тем выше балл за ясность"}</span>
          <span>{description.length} / {spec?.minDescription ?? 120} мин.</span>
        </div>

        <div style={twoCol}>
          <div>
            <SmallLabel>Отрасль</SmallLabel>
            <select value={sector} onChange={(e) => setSector(e.target.value)} style={input}>
              <option value="">Определить автоматически</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <SmallLabel>География</SmallLabel>
            <input value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="KZ, US, Global" style={input} />
          </div>
        </div>

        {tier !== "idea" && (
          <div style={twoCol}>
            <div>
              <SmallLabel>Ссылка на продукт {spec?.requiresDemoUrl && <Req />}</SmallLabel>
              <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://…" style={input} />
              <FieldError message={issueFor("demoUrl")} />
            </div>
            <div>
              <SmallLabel>Репозиторий (необязательно)</SmallLabel>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/…" style={input} />
            </div>
          </div>
        )}

        {phase === "draft" && (
          <button type="button" onClick={() => runAssessment("terms")} disabled={busy || description.trim().length < 20} style={primaryBtn(busy)}>
            {busy ? "Считаю…" : "Показать бесплатный анализ"}
          </button>
        )}
      </div>

      {/* ── Assessment ────────────────────────────────────────────────────── */}
      {assessment && <AssessmentPanel a={assessment} />}

      {/* ── Terms ─────────────────────────────────────────────────────────── */}
      {phase === "terms" && (
        <div style={card}>
          <Label>Условия сделки</Label>
          <p style={{ margin: "6px 0 12px", fontSize: 12.5, color: "#64748b", lineHeight: 1.55 }}>
            Теперь, когда вы видите разбор, назовите условия. Инвестор увидит их рядом с рыночным диапазоном.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {allowedIntents.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntent(i)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: `1px solid ${effectiveIntent === i ? TIER_ACCENT[tier] : "#e2e8f0"}`,
                  background: effectiveIntent === i ? `${TIER_ACCENT[tier]}0f` : "#fff",
                  color: effectiveIntent === i ? TIER_ACCENT[tier] : "#475569",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {INTENT_LABEL[i]}
              </button>
            ))}
          </div>

          {effectiveIntent === "raise" && (
            <>
              <div style={twoCol}>
                <div>
                  <SmallLabel>Сколько нужно, USD <Req /></SmallLabel>
                  <input value={askUsd} onChange={(e) => setAskUsd(e.target.value)} placeholder="30000" style={input} inputMode="numeric" />
                  <FieldError message={issueFor("deal.askUsd")} />
                </div>
                <div>
                  <SmallLabel>Какую долю отдаёте, % <Req /></SmallLabel>
                  <input value={equityPct} onChange={(e) => setEquityPct(e.target.value)} placeholder="15" style={input} inputMode="decimal" />
                  <FieldError message={issueFor("deal.equityOfferedPct")} />
                </div>
              </div>
              <SmallLabel>Кто доводит продукт</SmallLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {(["founder", "shared", "investor"] as BuildBy[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBuildBy(b)}
                    style={{
                      padding: "6px 11px",
                      borderRadius: 8,
                      border: `1px solid ${buildBy === b ? "#0f172a" : "#e2e8f0"}`,
                      background: buildBy === b ? "#0f172a" : "#fff",
                      color: buildBy === b ? "#fff" : "#475569",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {BUILD_BY_LABEL[b]}
                  </button>
                ))}
              </div>
            </>
          )}

          {effectiveIntent === "sell_full" && (
            <div>
              <SmallLabel>Цена продажи целиком, USD <Req /></SmallLabel>
              <input value={askingPrice} onChange={(e) => setAskingPrice(e.target.value)} placeholder="150000" style={input} inputMode="numeric" />
              <FieldError message={issueFor("deal.askingPriceUsd")} />
            </div>
          )}

          {effectiveIntent === "sell_stake" && (
            <div style={twoCol}>
              <div>
                <SmallLabel>Размер доли, % <Req /></SmallLabel>
                <input value={stakePct} onChange={(e) => setStakePct(e.target.value)} placeholder="20" style={input} inputMode="decimal" />
                <FieldError message={issueFor("deal.stakeForSalePct")} />
              </div>
              <div>
                <SmallLabel>Цена доли, USD <Req /></SmallLabel>
                <input value={stakePrice} onChange={(e) => setStakePrice(e.target.value)} placeholder="60000" style={input} inputMode="numeric" />
                <FieldError message={issueFor("deal.stakePriceUsd")} />
              </div>
            </div>
          )}

          <SmallLabel>Дополнительные условия (необязательно)</SmallLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Например: готов остаться в проекте на 6 месяцев после сделки"
            style={{ ...input, resize: "vertical" }}
          />

          {tier !== "idea" && (
            <>
              <Label>Цифры проекта</Label>
              <p style={{ margin: "4px 0 10px", fontSize: 12, color: "#94a3b8" }}>
                Необязательно, но именно они переводят балл с «по отрасли» на «по данным заявки».
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                <div><SmallLabel>MRR, USD</SmallLabel><input value={mrr} onChange={(e) => setMrr(e.target.value)} placeholder="2500" style={input} inputMode="numeric" /></div>
                <div><SmallLabel>Пользователей</SmallLabel><input value={users} onChange={(e) => setUsers(e.target.value)} placeholder="1200" style={input} inputMode="numeric" /></div>
                <div><SmallLabel>Рост, %/мес</SmallLabel><input value={growth} onChange={(e) => setGrowth(e.target.value)} placeholder="8" style={input} inputMode="decimal" /></div>
                <div><SmallLabel>Команда, чел.</SmallLabel><input value={teamSize} onChange={(e) => setTeamSize(e.target.value)} placeholder="2" style={input} inputMode="numeric" /></div>
              </div>
            </>
          )}

          <Label>Как с вами связаться</Label>
          <div style={twoCol}>
            <div>
              <SmallLabel>Email (не публикуется)</SmallLabel>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={input} type="email" />
            </div>
            <div>
              <SmallLabel>Публичный контакт</SmallLabel>
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="@telegram или сайт" style={input} />
            </div>
          </div>

          {issues.length > 0 && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 12px", margin: "10px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 4 }}>Не хватает для публикации:</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {issues.map((i) => (
                  <li key={i.field} style={{ fontSize: 12.5, color: "#7f1d1d", lineHeight: 1.5 }}>{i.message}</li>
                ))}
              </ul>
            </div>
          )}
          {error && <p style={{ color: "#dc2626", fontSize: 12.5, margin: "8px 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <button type="button" onClick={() => runAssessment("terms")} disabled={busy} style={secondaryBtn(busy)}>
              Пересчитать с условиями
            </button>
            <button type="button" onClick={publish} disabled={busy} style={primaryBtn(busy)}>
              {busy ? "Публикую…" : "Опубликовать на бирже"}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5 }}>
            При публикации заявка получает SHA-256 отпечаток текста — фиксирует авторство на дату подачи.
            Email виден только вам, инвесторы пишут через форму отклика.
          </p>
        </div>
      )}
    </div>
  );
}

// ── local styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 20,
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid #e2e8f0",
  fontSize: 13.5,
  fontFamily: "inherit",
  color: "#0f172a",
  background: "#fff",
  marginBottom: 10,
  boxSizing: "border-box",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
};

function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    padding: "11px 20px",
    borderRadius: 10,
    border: "none",
    background: busy ? "#94a3b8" : "#0f172a",
    color: "#fff",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: busy ? "wait" : "pointer",
  };
}

function secondaryBtn(busy: boolean): React.CSSProperties {
  return {
    padding: "11px 18px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: busy ? "wait" : "pointer",
  };
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{children}</div>;
}

function SmallLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{children}</div>;
}

function Req() {
  return <span style={{ color: "#dc2626" }}>*</span>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p style={{ margin: "-6px 0 8px", fontSize: 11.5, color: "#dc2626" }}>{message}</p>;
}
