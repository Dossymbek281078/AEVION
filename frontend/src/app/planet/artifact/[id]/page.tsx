"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { nominationLabel, planetNominationOptions } from "@/lib/planetNominations";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";

const TOKEN_KEY = "aevion_auth_token_v1";
const cardStyle: CSSProperties = {
  border: "1px solid rgba(0,0,0,0.12)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 16,
};
const clampScore = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

export default function PlanetArtifactPublicPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const { showToast } = useToast();

  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [token, setToken] = useState("");

  const [score, setScore] = useState(5);
  const [categoryId, setCategoryId] = useState("general");
  const [seasonId, setSeasonId] = useState("2026-s1");
  const [busy, setBusy] = useState(false);
  const [codeSymbol, setCodeSymbol] = useState<string | null>(null);
  const [proofJson, setProofJson] = useState<string | null>(null);
  const [planetStats, setPlanetStats] = useState<{
    eligibleParticipants: number;
    distinctVotersAllTime: number;
  } | null>(null);

  const artifactType = data?.artifact?.artifactType as string | undefined;
  const nominationOptions = useMemo(() => planetNominationOptions(artifactType), [artifactType]);
  const voteCount = data?.voteStats?.count ?? 0;
  const voteAverage = data?.voteStats?.average ?? null;
  const voteProgressPercent = useMemo(() => {
    if (!planetStats?.eligibleParticipants || !voteCount) return 0;
    const p = Math.round((voteCount / planetStats.eligibleParticipants) * 100);
    return Math.max(0, Math.min(100, p));
  }, [planetStats?.eligibleParticipants, voteCount]);
  const categoryRows = useMemo(() => {
    if (!data?.voteStatsByCategory || typeof data.voteStatsByCategory !== "object") return [];
    return Object.entries(data.voteStatsByCategory)
      .map(([cat, st]: [string, any]) => ({
        categoryId: cat,
        label: nominationLabel(artifactType, cat),
        count: Number(st?.count ?? 0),
        average: st?.average ?? null,
      }))
      .sort((a, b) => b.count - a.count);
  }, [data?.voteStatsByCategory, artifactType]);

  const loadPublic = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/planet/artifacts/${id}/public`));
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "load failed");
      setData(j);
    } catch (e: any) {
      setErr(e?.message || "error");
      setData(null);
    }
  }, [id]);

  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) || "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/planet/stats"));
        const j = await r.json().catch(() => null);
        if (!r.ok || cancelled) return;
        setPlanetStats({
          eligibleParticipants: j.eligibleParticipants ?? 0,
          distinctVotersAllTime: j.distinctVotersAllTime ?? 0,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!nominationOptions.length) return;
    const allowed = new Set(nominationOptions.map((o) => o.id));
    if (!allowed.has(categoryId)) setCategoryId("general");
  }, [nominationOptions, categoryId]);

  const loadMySymbol = async () => {
    if (!token) return;
    const r = await fetch(apiUrl("/api/planet/me/code-symbol"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => null);
    if (r.ok) setCodeSymbol(j.codeSymbol);
  };

  useEffect(() => {
    if (token) loadMySymbol();
  }, [token]);

  const vote = async () => {
    setBusy(true);
    try {
      if (!token) throw new Error("Нужен вход: /auth");
      const normalizedScore = clampScore(Number.isFinite(score) ? score : 5);
      if (!Number.isFinite(normalizedScore)) throw new Error("Некорректная оценка");
      const r = await fetch(apiUrl(`/api/planet/artifacts/${id}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ score: normalizedScore, categoryId: categoryId.trim() || "general" }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "vote failed");
      showToast(`Голос принят. Ваш публичный символ: ${j.codeSymbol}`, "success");
      setScore(normalizedScore);
      await loadPublic();
    } catch (e: any) {
      showToast(e?.message || "Ошибка голосования", "error");
    } finally {
      setBusy(false);
    }
  };

  const finalizeSnapshot = async () => {
    setBusy(true);
    try {
      if (!token) throw new Error("Нужен вход (только владелец артефакта)");
      const r = await fetch(apiUrl(`/api/planet/artifacts/${id}/votes/snapshot`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ seasonId: seasonId.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "snapshot failed");
      showToast(`Снапшот сезона зафиксирован. rootHash: ${j.rootHash}`, "success");
      setProofJson(null);
      await loadPublic();
    } catch (e: any) {
      showToast(e?.message || "Ошибка снапшота", "error");
    } finally {
      setBusy(false);
    }
  };

  const copyPublicUrl = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Ссылка скопирована", "success", 3200);
    } catch {
      showToast("Не удалось скопировать (разрешите доступ к буферу)", "error");
    }
  };

  const fetchMyProof = async () => {
    setBusy(true);
    setProofJson(null);
    try {
      if (!token) throw new Error("Нужен вход");
      const r = await fetch(
        `${apiUrl(`/api/planet/artifacts/${id}/votes/my-proof`)}?seasonId=${encodeURIComponent(seasonId.trim())}&categoryId=${encodeURIComponent(categoryId.trim() || "general")}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(j?.error || "proof failed");
      setProofJson(JSON.stringify(j, null, 2));
      showToast("Merkle-proof загружен", "info");
    } catch (e: any) {
      showToast(e?.message || "Ошибка proof", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!id) {
    return (
      <main>
        <ProductPageShell maxWidth={960}>
          <Wave1Nav hidePlanet />
          Некорректный id
        </ProductPageShell>
      </main>
    );
  }

  return (
    <main>
      <ProductPageShell maxWidth={960}>
      <Wave1Nav hidePlanet />
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "8px 12px", alignItems: "center" }}>
        <Link href="/planet" style={{ color: "#0f172a", fontWeight: 600 }}>
          ← Planet lab
        </Link>
        <span style={{ color: "#94a3b8" }}>|</span>
        <Link href="/awards" style={{ color: "#0f172a", fontWeight: 600 }}>
          Awards hub
        </Link>
        <button
          type="button"
          onClick={copyPublicUrl}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid rgba(15,23,42,0.2)",
            background: "#fff",
            color: "#334155",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Скопировать ссылку
        </button>
      </div>

      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Публичная витрина артефакта</h1>
      <div style={{ color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
        Видно всем только если есть сертификат (compliance passed). Голоса отображаются по{" "}
        <b>CodeSymbol</b>, без email/имени. Снапшот сезона фиксирует Merkle root для проверки.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          ["#summary", "Сводка"],
          ["#votes", "Голосование"],
          ["#season", "Сезон"],
          ["#snapshot", "Снапшот"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              border: "1px solid rgba(0,0,0,0.16)",
              borderRadius: 999,
              padding: "6px 10px",
              color: "#334155",
              fontSize: 12,
              fontWeight: 700,
              background: "#fff",
            }}
          >
            {label}
          </a>
        ))}
      </div>
      <div className="aevion-sticky-vote">
        <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>Быстрое действие:</span>
        <label style={{ fontSize: 12, color: "#334155" }}>
          Оценка{" "}
          <input
            type="number"
            min={1}
            max={5}
            value={score}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (Number.isFinite(raw)) setScore(clampScore(raw));
            }}
            style={{ width: 56, padding: "4px 6px", marginLeft: 4 }}
          />
        </label>
        <button
          type="button"
          onClick={vote}
          disabled={busy}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #0f172a",
            background: "#0f172a",
            color: "#fff",
            fontWeight: 800,
            fontSize: 12,
            cursor: "pointer",
            opacity: busy ? 0.75 : 1,
          }}
        >
          Голосовать
        </button>
        <a
          href="#votes"
          style={{
            textDecoration: "none",
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.2)",
            color: "#334155",
            fontWeight: 700,
            fontSize: 12,
            background: "#fff",
          }}
        >
          К полному блоку →
        </a>
      </div>

      {err ? (
        <div
          style={{
            color: "#991b1b",
            marginBottom: 12,
            border: "1px solid rgba(220,38,38,0.25)",
            background: "rgba(220,38,38,0.08)",
            borderRadius: 10,
            padding: "9px 10px",
            fontSize: 13,
          }}
        >
          {err}
        </div>
      ) : null}
      {data?.artifact ? (
        <section id="summary" style={cardStyle}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{data.artifact.submissionTitle}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            {data.artifact.artifactType} • v{data.artifact.versionNo} • {data.artifact.status}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>artifactVersionId</div>
          <div style={{ fontFamily: "monospace", wordBreak: "break-all", fontSize: 12 }}>{data.artifact.id}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>evidenceRoot</div>
          <div style={{ fontFamily: "monospace", wordBreak: "break-all", fontSize: 12 }}>{data.artifact.evidenceRoot}</div>
          {data.versionLineage?.parentVersionId && data.versionLineage?.parentVersion ? (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <span style={{ color: "#666" }}>Предыдущая версия (пересдача): </span>
              <Link href={`/planet/artifact/${data.versionLineage.parentVersion.id}`} style={{ fontWeight: 700 }}>
                v{data.versionLineage.parentVersion.versionNo} →
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {data?.certificate ? (
        <section style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Сертификат (public payload)</div>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 10, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(data.certificate.publicPayloadJson || data.certificate, null, 2)}
          </pre>
        </section>
      ) : null}

      {planetStats ? (
        <section style={{ ...cardStyle, background: "#fafafa" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Участники Planet (для «X из Y»)</div>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>
            <strong>Y</strong> (активный CodeSymbol): <b>{planetStats.eligibleParticipants}</b>
            <br />
            Уникальных голосовавших (всё время): <b>{planetStats.distinctVotersAllTime}</b>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            Метрики из <code>GET /api/planet/stats</code> — см. <code>AEVION_AWARDS_SPEC.md</code>.
          </div>
        </section>
      ) : null}

      {data?.voteStats?.count > 0 ? (
        <section style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Статистика голосов</div>
          <div style={{ fontSize: 14, marginBottom: 10 }}>
            Голосов: <b>{voteCount}</b>, среднее: <b>{voteAverage ?? "—"}</b>
          </div>
          {planetStats?.eligibleParticipants ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                Покрытие голосования: {voteCount} из {planetStats.eligibleParticipants} ({voteProgressPercent}%)
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${voteProgressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #0ea5e9, #0d9488)",
                  }}
                />
              </div>
            </div>
          ) : null}
          <pre style={{ marginTop: 8, background: "#fafafa", padding: 10, borderRadius: 10, fontSize: 12 }}>
            {JSON.stringify(data.voteStats.histogram, null, 2)}
          </pre>
        </section>
      ) : null}

      {categoryRows.length > 0 ? (
        <section style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Голоса по номинациям</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginBottom: 12 }}>
            {categoryRows.slice(0, 3).map((row) => (
              <article
                key={`top:${row.categoryId}`}
                style={{
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 10,
                  padding: "8px 9px",
                  background: "rgba(15,23,42,0.02)",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b" }}>Топ номинация</div>
                <div style={{ marginTop: 3, fontWeight: 800, fontSize: 13 }}>{row.label}</div>
                <div style={{ marginTop: 3, fontSize: 12, color: "#334155" }}>
                  Голосов: <b>{row.count}</b> · Среднее: <b>{row.average ?? "—"}</b>
                </div>
              </article>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  <th style={{ padding: 8 }}>Номинация</th>
                  <th style={{ padding: 8 }}>categoryId</th>
                  <th style={{ padding: 8 }}>Голосов</th>
                  <th style={{ padding: 8 }}>Среднее</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((row) => (
                  <tr key={row.categoryId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>{row.label}</td>
                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{row.categoryId}</td>
                    <td style={{ padding: 8 }}>{row.count}</td>
                    <td style={{ padding: 8 }}>{row.average ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data?.complianceSummary?.plagiarism || data?.complianceSummary?.license ? (
        <section style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Краткий compliance-отчёт (публично)</div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Плагиат/лицензия — сжато для витрины; полный список валидаторов ниже при необходимости.
          </div>
          <pre style={{ background: "#f8f8f8", padding: 12, borderRadius: 10, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(
              {
                plagiarism: data.complianceSummary?.plagiarism,
                license: data.complianceSummary?.license,
                risk: data.complianceSummary?.risk,
              },
              null,
              2,
            )}
          </pre>
        </section>
      ) : null}

      <section id="votes" style={cardStyle}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Голосование (внутри системы)</div>
        <div style={{ fontSize: 13, color: "#555", marginBottom: 10 }}>
          Ваш текущий CodeSymbol: <b>{codeSymbol || "— (войдите и обновите страницу)"}</b>
        </div>
        {data?.artifact?.artifactType ? (
          <div style={{ fontSize: 12, color: "#666", marginBottom: 10 }}>
            Номинации для типа <b>{data.artifact.artifactType}</b> (стабильные <code>categoryId</code> для премий).
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Оценка 1–5:{" "}
            <input
              type="number"
              min={1}
              max={5}
              value={score}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (Number.isFinite(raw)) setScore(clampScore(raw));
              }}
              style={{ width: 64, padding: 8 }}
            />
          </label>
          <label>
            Номинация:{" "}
            <select
              value={nominationOptions.some((o) => o.id === categoryId) ? categoryId : "general"}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ minWidth: 220, padding: 8 }}
            >
              {nominationOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.id})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={vote}
            disabled={busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", fontWeight: 800 }}
          >
            Проголосовать
          </button>
          <Link
            href={artifactType === "music" ? "/awards/music" : artifactType === "movie" ? "/awards/film" : "/awards"}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "#fff",
              color: "#334155",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            К витрине премии
          </Link>
        </div>
      </section>

      <section id="season" style={cardStyle}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Сезон и снапшот (владелец артефакта)</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            placeholder="season id"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", minWidth: 200 }}
          />
          <button
            type="button"
            onClick={finalizeSnapshot}
            disabled={busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #b80", background: "#fff", color: "#b80", fontWeight: 800 }}
          >
            Зафиксировать снапшот голосов
          </button>
          <button
            type="button"
            onClick={fetchMyProof}
            disabled={busy}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#fff", color: "#111", fontWeight: 800 }}
          >
            Мой Merkle-proof
          </button>
        </div>
        {proofJson ? (
          <pre style={{ marginTop: 12, background: "#f8f8f8", padding: 12, borderRadius: 10, fontSize: 11, overflow: "auto" }}>
            {proofJson}
          </pre>
        ) : null}
      </section>

      {data?.votes?.length ? (
        <section style={cardStyle}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Голоса (только CodeSymbol)</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                  <th style={{ padding: 8 }}>CodeSymbol</th>
                  <th style={{ padding: 8 }}>Score</th>
                  <th style={{ padding: 8 }}>Category</th>
                  <th style={{ padding: 8 }}>leafHash</th>
                </tr>
              </thead>
              <tbody>
                {data.votes.map((v: any, i: number) => (
                  <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8, fontFamily: "monospace" }}>{v.codeSymbol}</td>
                    <td style={{ padding: 8 }}>{v.score}</td>
                    <td style={{ padding: 8 }}>{v.categoryId}</td>
                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 10, wordBreak: "break-all" }}>{v.leafHash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {data?.validators ? (
        <details style={{ marginBottom: 16, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 14, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 800 }}>Все валидаторы (raw JSON)</summary>
          <pre style={{ marginTop: 10, background: "#fafafa", padding: 12, borderRadius: 10, fontSize: 10, overflow: "auto", maxHeight: 420 }}>
            {JSON.stringify(data.validators, null, 2)}
          </pre>
        </details>
      ) : null}

      {data?.latestSnapshot ? (
        <section id="snapshot" style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Последний снапшот</div>
          <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 10, fontSize: 11, overflow: "auto" }}>
            {JSON.stringify(
              {
                seasonId: data.latestSnapshot.seasonId,
                rootHash: data.latestSnapshot.rootHash,
                voteCount: data.latestSnapshot.voteCount,
                publicSalt: data.latestSnapshot.publicSalt,
                signature: data.latestSnapshot.signature,
                createdAt: data.latestSnapshot.createdAt,
              },
              null,
              2,
            )}
          </pre>
        </section>
      ) : null}
      </ProductPageShell>
    </main>
  );
}
