"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import CapsuleForm, { type CategoryOption } from "./components/CapsuleForm";
import CapsuleCard, { type CapsulePreview } from "./components/CapsuleCard";
import CapsuleReader from "./components/CapsuleReader";
import StatsBar, { type StatsPayload } from "./components/StatsBar";

const API = "/api-backend/api/lifebox";
const ALIAS_KEY = "lifebox.alias";

const palette = {
  gold:     "#d4af37",
  goldSoft: "#f5d27a",
  navy:     "#0b1736",
  navy2:    "#131f3d",
  navyDeep: "#050a1a",
  ink:      "#e7ecf8",
  inkDim:   "#9aa3c0",
};

type FilterMode = "all" | "locked" | "unlocked";

export default function LifeBoxPage() {
  const [alias, setAlias] = useState<string>("");
  const [aliasInput, setAliasInput] = useState<string>("");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [capsules, setCapsules] = useState<CapsulePreview[]>([]);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  // Reader modal state
  const [reader, setReader] = useState<CapsulePreview | null>(null);
  const [readerContent, setReaderContent] = useState<string | null>(null);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);

  // Load alias from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ALIAS_KEY);
      if (saved && saved.trim()) {
        setAlias(saved.trim());
        setAliasInput(saved.trim());
      }
    } catch { /* ignore */ }
  }, []);

  // Persist alias when set
  useEffect(() => {
    try {
      if (alias) window.localStorage.setItem(ALIAS_KEY, alias);
    } catch { /* ignore */ }
  }, [alias]);

  // Load categories once
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/categories`);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.categories)) setCategories(j.categories);
      } catch { /* ignore */ }
    })();
  }, []);

  const loadCapsules = useCallback(async (currentAlias: string) => {
    if (!currentAlias) return;
    setLoadingList(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        fetch(`${API}/capsules/${encodeURIComponent(currentAlias)}`),
        fetch(`${API}/stats`),
      ]);
      const listJson = await listRes.json();
      const statsJson = await statsRes.json();
      if (listJson?.ok && Array.isArray(listJson.capsules)) {
        setCapsules(listJson.capsules);
      }
      if (statsJson?.ok) {
        setStats({
          total: statsJson.total ?? 0,
          byCategory: statsJson.byCategory ?? {},
          unlockedToday: statsJson.unlockedToday ?? 0,
        });
      }
    } catch { /* ignore */ } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { if (alias) loadCapsules(alias); }, [alias, loadCapsules]);

  const handleSetAlias = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = aliasInput.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (clean.length > 0) setAlias(clean);
  };

  const handleCreate = async (payload: {
    alias: string; title: string; content: string; category: string; unlock_at: string;
  }) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/capsules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      await loadCapsules(alias);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (capsule: CapsulePreview) => {
    setReader(capsule);
    setReaderContent(null);
    setReaderError(null);
    if (capsule.locked) return;
    setReaderLoading(true);
    try {
      const r = await fetch(
        `${API}/capsules/${capsule.id}/unlock?alias=${encodeURIComponent(alias)}`
      );
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setReaderError(j?.error || `Не удалось открыть (HTTP ${r.status})`);
        return;
      }
      setReaderContent(j.capsule?.content ?? "");
    } catch (e: any) {
      setReaderError(e?.message || "Ошибка сети");
    } finally {
      setReaderLoading(false);
    }
  };

  const handleDelete = async (capsule: CapsulePreview) => {
    if (!confirm(`Удалить капсулу «${capsule.title}»?`)) return;
    try {
      await fetch(
        `${API}/capsules/${capsule.id}?alias=${encodeURIComponent(alias)}`,
        { method: "DELETE" }
      );
      await loadCapsules(alias);
    } catch { /* ignore */ }
  };

  const filtered = useMemo(() => {
    if (filter === "locked") return capsules.filter((c) => c.locked);
    if (filter === "unlocked") return capsules.filter((c) => !c.locked);
    return capsules;
  }, [capsules, filter]);

  const pageBg: React.CSSProperties = {
    minHeight: "100vh",
    background: `radial-gradient(ellipse at top, ${palette.navy2} 0%, ${palette.navyDeep} 70%)`,
    color: palette.ink,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  };

  return (
    <div style={pageBg}>
      <header style={{
        borderBottom: `1px solid ${palette.gold}30`,
        padding: "16px 24px",
        background: `${palette.navyDeep}aa`,
        backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <Link href="/" style={{ color: palette.inkDim, fontSize: 13, textDecoration: "none" }}>
          ← AEVION
        </Link>
        <div style={{ fontFamily: "monospace", color: palette.goldSoft, letterSpacing: "0.15em", fontSize: 13 }}>
          ✦ LIFEBOX ✦
        </div>
      </header>

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 30px", textAlign: "center" }}>
        <div style={{ color: palette.gold, fontSize: 11, letterSpacing: "0.35em", textTransform: "uppercase", marginBottom: 14 }}>
          Сейф для будущего «я»
        </div>
        <h1 style={{
          fontSize: "clamp(32px, 5vw, 52px)",
          fontWeight: 200,
          margin: "0 0 14px",
          color: palette.ink,
          lineHeight: 1.15,
        }}>
          Оставь себе послание,{" "}
          <span style={{
            background: `linear-gradient(90deg, ${palette.gold}, ${palette.goldSoft})`,
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            запечатанное во времени.
          </span>
        </h1>
        <p style={{ color: palette.inkDim, fontSize: 16, maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
          Капсулы открываются строго по дате. Знания, ценности, инструкции и послания
          будущему себе — то, что ты хочешь передать через годы.
        </p>
      </section>

      {!alias ? (
        <section style={{ maxWidth: 540, margin: "0 auto", padding: "0 24px 60px" }}>
          <form onSubmit={handleSetAlias} style={{
            background: `linear-gradient(180deg, ${palette.navy}ee, ${palette.navy2}ee)`,
            border: `1px solid ${palette.gold}40`,
            borderRadius: 16, padding: 24,
            boxShadow: `0 0 40px -20px ${palette.gold}aa`,
          }}>
            <div style={{ color: palette.inkDim, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
              Твой псевдоним
            </div>
            <p style={{ color: palette.inkDim, fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
              Выбери уникальное имя — это твой ключ к капсулам. Сохраняется в этом браузере.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="например: my_future_self"
                maxLength={64}
                style={{
                  flex: 1, background: palette.navy, color: palette.ink,
                  border: `1px solid ${palette.gold}33`, borderRadius: 10,
                  padding: "12px 14px", fontSize: 14, outline: "none", fontFamily: "inherit",
                }}
              />
              <button type="submit" style={{
                background: `linear-gradient(90deg, ${palette.gold}, ${palette.goldSoft})`,
                border: "none", color: palette.navy, padding: "12px 20px",
                borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>
                Войти
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 10, marginBottom: 18,
          }}>
            <div style={{ color: palette.inkDim, fontSize: 13 }}>
              Псевдоним: <span style={{ color: palette.goldSoft, fontFamily: "monospace" }}>{alias}</span>
            </div>
            <button onClick={() => { setAlias(""); setAliasInput(""); setCapsules([]); }}
              style={{
                background: "transparent", border: `1px solid ${palette.inkDim}40`,
                color: palette.inkDim, fontSize: 11, padding: "5px 12px",
                borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
              }}>
              сменить
            </button>
          </div>

          <StatsBar stats={stats} loading={loadingList && !stats} />

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 28, marginBottom: 32 }}>
            <CapsuleForm alias={alias} categories={categories} onCreate={handleCreate} busy={busy} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <h2 style={{ margin: 0, color: palette.goldSoft, fontSize: 20, fontWeight: 300, letterSpacing: "0.04em" }}>
              Мои капсулы ({capsules.length})
            </h2>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "locked", "unlocked"] as FilterMode[]).map((m) => (
                <button key={m} onClick={() => setFilter(m)}
                  style={{
                    background: filter === m ? `${palette.gold}25` : "transparent",
                    border: `1px solid ${palette.gold}${filter === m ? "70" : "30"}`,
                    color: filter === m ? palette.goldSoft : palette.inkDim,
                    fontSize: 11, padding: "5px 12px", borderRadius: 999,
                    cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
                    fontFamily: "inherit",
                  }}>
                  {m === "all" ? "все" : m === "locked" ? "🔒 запечатаны" : "🔓 открыты"}
                </button>
              ))}
            </div>
          </div>

          {loadingList && capsules.length === 0 ? (
            <div style={{ color: palette.inkDim, padding: "40px 0", textAlign: "center" }}>Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div style={{
              padding: 36, textAlign: "center",
              border: `1px dashed ${palette.gold}40`, borderRadius: 14,
              color: palette.inkDim, fontSize: 14,
            }}>
              {capsules.length === 0
                ? "Пока ни одной капсулы. Создай первую — выше."
                : "В этом фильтре пусто."}
            </div>
          ) : (
            <div style={{
              display: "grid", gap: 16,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}>
              {filtered.map((c) => (
                <CapsuleCard key={c.id} capsule={c} onOpen={handleOpen} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      {reader && (
        <CapsuleReader
          capsule={reader}
          fullContent={readerContent}
          loading={readerLoading}
          error={readerError}
          onClose={() => { setReader(null); setReaderContent(null); setReaderError(null); }}
        />
      )}

      <footer style={{
        borderTop: `1px solid ${palette.gold}20`, padding: "30px 24px",
        textAlign: "center", color: palette.inkDim, fontSize: 12,
      }}>
        ✦ AEVION LifeBox · MVP · сейф для будущего «я»
      </footer>
    </div>
  );
}
