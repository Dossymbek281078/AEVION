"use client";

import { useEffect, useState, useCallback } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";
import { SubmitIdeaForm } from "./components/SubmitIdeaForm";
import { IdeaCard, type Idea } from "./components/IdeaCard";
import { InterestModal } from "./components/InterestModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type StageFilter = "" | "idea" | "prototype" | "mvp" | "scaling";

interface Stats {
  total: number;
  byStage: Record<string, number>;
  recentCount: number;
}

const STAGE_TABS: Array<{ id: StageFilter; label: string }> = [
  { id: "",          label: "Все" },
  { id: "idea",      label: "Idea" },
  { id: "prototype", label: "Prototype" },
  { id: "mvp",       label: "MVP" },
  { id: "scaling",   label: "Scaling" },
];

const PAGE_SIZE = 10;

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: "#0f172a",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 1100,
        maxWidth: 360,
      }}
    >
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StartupExchangePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<StageFilter>("");
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [interestFor, setInterestFor] = useState<Idea | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchIdeas = useCallback(
    async (filter: StageFilter, off: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String(off));
        if (filter) params.set("stage", filter);
        const resp = await fetch(apiUrl(`/api/startupx/ideas?${params.toString()}`));
        if (resp.ok) {
          const data = await resp.json();
          if (data?.success) {
            setIdeas(data.data.ideas ?? []);
            setTotal(Number(data.data.total) || 0);
          }
        }
      } catch {
        /* swallow */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(apiUrl("/api/startupx/stats"));
      if (resp.ok) {
        const data = await resp.json();
        if (data?.success) setStats(data.data);
      }
    } catch {
      /* swallow */
    }
  }, []);

  useEffect(() => {
    fetchIdeas(stageFilter, offset);
  }, [stageFilter, offset, fetchIdeas]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function handleSubmitted(result: { id: number; qrightProtected: boolean; contentHash: string }) {
    setToast(
      result.qrightProtected
        ? `Идея #${result.id} защищена · sha256:${result.contentHash.slice(0, 12)}…`
        : `Идея #${result.id} опубликована`,
    );
    setOffset(0);
    fetchIdeas(stageFilter, 0);
    fetchStats();
  }

  function handleInterested(ideaId: number) {
    setToast(`Заявка отправлена основателю идеи #${ideaId}`);
    fetchIdeas(stageFilter, offset);
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: active ? "#7c3aed" : "#f1f5f9",
    color: active ? "#fff" : "#475569",
    transition: "background 0.15s",
  });

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        {/* Hero */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: "inline-block",
              padding: "3px 12px",
              borderRadius: 20,
              background: "#f5f3ff",
              color: "#7c3aed",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Биржа стартапов · IP-protected
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
            От идеи → IP-метка → инвестор
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#475569", lineHeight: 1.6, maxWidth: 720 }}>
            Подайте идею — она автоматически получает SHA-256 контент-хеш (QRight-совместимая
            метка), публикуется в публичной ленте и становится видимой для инвесторов. Инвесторы
            оставляют заявки на интерес и получают ваш контакт.
          </p>
        </div>

        {/* Stats strip */}
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <StatTile label="Всего идей" value={stats.total} accent="#7c3aed" />
            <StatTile label="За 7 дней" value={stats.recentCount} accent="#0d9488" />
            <StatTile label="Idea" value={stats.byStage.idea ?? 0} accent="#a78bfa" />
            <StatTile label="Prototype" value={stats.byStage.prototype ?? 0} accent="#60a5fa" />
            <StatTile label="MVP" value={stats.byStage.mvp ?? 0} accent="#10b981" />
            <StatTile label="Scaling" value={stats.byStage.scaling ?? 0} accent="#f97316" />
          </div>
        )}

        {/* Layout */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 360px",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          {/* Main column — feed */}
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {STAGE_TABS.map((tab) => (
                <button
                  key={tab.id || "all"}
                  type="button"
                  onClick={() => {
                    setStageFilter(tab.id);
                    setOffset(0);
                  }}
                  style={tabBtn(stageFilter === tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loading && (
              <p style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>
                Загружаю идеи…
              </p>
            )}

            {!loading && ideas.length === 0 && (
              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 40,
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>○</div>
                <div>Пока нет идей в этой категории.</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Будьте первыми — заполните форму справа.</div>
              </div>
            )}

            {ideas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onInterest={(i) => setInterestFor(i)}
              />
            ))}

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: offset === 0 ? "not-allowed" : "pointer",
                    opacity: offset === 0 ? 0.5 : 1,
                  }}
                >
                  ← Назад
                </button>
                <span style={{ alignSelf: "center", fontSize: 12, color: "#64748b" }}>
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
                </span>
                <button
                  type="button"
                  disabled={offset + PAGE_SIZE >= total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer",
                    opacity: offset + PAGE_SIZE >= total ? 0.5 : 1,
                  }}
                >
                  Вперёд →
                </button>
              </div>
            )}
          </div>

          {/* Right column — submit form */}
          <div style={{ position: "sticky", top: 24 }}>
            <SubmitIdeaForm onSubmitted={handleSubmitted} />

            <div
              style={{
                marginTop: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                fontSize: 12,
                color: "#64748b",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6, fontSize: 13 }}>
                Как работает защита
              </div>
              При публикации backend считает SHA-256 от <code style={{ background: "#fff", padding: "1px 4px", borderRadius: 4 }}>(title, description, stage)</code>{" "}
              и сохраняет его как content-hash. Это та же схема, что использует QRight, — позже идею можно перенести в QRight-реестр без переподписи.
            </div>
          </div>
        </div>
      </ProductPageShell>

      {interestFor && (
        <InterestModal
          idea={interestFor}
          onClose={() => setInterestFor(null)}
          onSubmitted={(id) => {
            setInterestFor(null);
            handleInterested(id);
          }}
        />
      )}

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

// ─── StatTile ─────────────────────────────────────────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}
