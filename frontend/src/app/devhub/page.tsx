"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { useDevhubT } from "./i18n";
import { catalog } from "@/lib/aevionCatalog";
import { fixDoubledScheme } from "@/lib/urls";
import { track } from "@/lib/track";
import { productById } from "@/lib/products";
import { PageTracking } from "@/components/PageTracking";

type Stack = "next" | "express" | "static" | "react" | "python";
type ProjectStatus = "draft" | "building" | "live" | "error";


interface Project {
  id: string;
  name: string;
  description: string | null;
  stack: Stack;
  status: ProjectStatus;
  deployUrl: string | null;
  needsRedeploy?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Snippet {
  id: string;
  /** Мой ли это сниппет. Личность автора наружу не отдаётся: по ней можно
   *  было бы назваться им (см. publicSnippet в routes/devhub.ts). */
  mine?: boolean;
  title: string;
  content: string;
  language: string;
  tags: string[];
  stars: number;
  createdAt: string;
  updatedAt: string;
}

const STACK_LABELS: Record<Stack, string> = {
  next: "Next.js",
  express: "Express",
  static: "Static",
  react: "React",
  python: "Python",
};

const STACK_COLORS: Record<Stack, { bg: string; fg: string }> = {
  next: { bg: "#0d9488", fg: "#fff" },
  express: { bg: "#7c3aed", fg: "#fff" },
  static: { bg: "#0369a1", fg: "#fff" },
  react: { bg: "#0284c7", fg: "#fff" },
  python: { bg: "#b45309", fg: "#fff" },
};

const STATUS_STYLES: Record<ProjectStatus, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#f1f5f9", fg: "#64748b", label: "Draft" },
  building: { bg: "#fef3c7", fg: "#92400e", label: "Building..." },
  live: { bg: "#d1fae5", fg: "#065f46", label: "Live" },
  error: { bg: "#fee2e2", fg: "#991b1b", label: "Error" },
};

const STACKS: Array<{ id: Stack; label: string; desc: string }> = [
  { id: "next", label: "Next.js", desc: "Full-stack React" },
  { id: "express", label: "Express", desc: "REST API" },
  { id: "static", label: "Static", desc: "HTML/CSS/JS" },
  { id: "react", label: "React SPA", desc: "Vite + React" },
  { id: "python", label: "Python", desc: "FastAPI / Flask" },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Price and checkout URL come from the product catalogue, which is verified
// against the live payment dashboards — the page must not carry its own copy.
const STUDIO_PRO = productById("devhub");

export default function DevHubPage() {
  const t = useDevhubT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<"free" | "pro" | "enterprise" | null>(null);
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [ideaStarting, setIdeaStarting] = useState(false);
  // What actually works right now, from the server. The landing used to
  // advertise every capability unconditionally while several were dead —
  // video on an empty balance, images with every provider blocked, voice on a
  // model the vendor had removed. Better to say so on the way in than to let
  // someone discover it after typing their idea.
  const [caps, setCaps] = useState<Array<{ id: string; name: string; status: string; lastError?: string }>>([]);

  // Prompt-first entry: one phrase → project created → generation auto-runs
  // in the IDE (the prompt travels via localStorage; the IDE picks it up,
  // fires /generate, and the chat + live preview show the result).
  const startFromIdea = async () => {
    const idea = ideaPrompt.trim();
    if (!idea || ideaStarting) return;
    setIdeaStarting(true);
    try {
      const name = idea.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).slice(0, 5).join(" ").slice(0, 40) || "My app";
      const r = await fetch(apiUrl("/api/devhub/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: idea, stack: "react" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t("err.create"));
      try { localStorage.setItem(`devhub_autoprompt_${data.project.id}`, idea); } catch { /* quota */ }
      router.push(`/devhub/${data.project.id}`);
    } catch (e: any) {
      setError(e.message);
      setIdeaStarting(false);
    }
  };
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", stack: "next" as Stack });
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(apiUrl("/api/devhub/projects"), { cache: "no-store" });
      const data = await r.json();
      setProjects(data.projects || []);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCaps(Array.isArray(d.capabilities) ? d.capabilities : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/credits"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.tier) setUserTier(d.tier); })
      .catch(() => {});
  }, []);

  const createProject = async () => {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(apiUrl("/api/devhub/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, description: form.description, stack: form.stack }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to create");
      setProjects((ps) => [data.project, ...ps]);
      setShowModal(false);
      setForm({ name: "", description: "", stack: "next" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm(t("proj.confirmDelete"))) return;
    try {
      await fetch(apiUrl(`/api/devhub/projects/${id}`), { method: "DELETE" });
      setProjects((ps) => ps.filter((p) => p.id !== id));
    } catch {
      setError("Delete failed");
    }
  };

  // ── Snippet Shelf ──────────────────────────────────────────────────────────
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetsLoading, setSnippetsLoading] = useState(true);
  const [snippetForm, setSnippetForm] = useState({
    title: "",
    language: "javascript",
    content: "",
    tags: "",
  });
  const [snippetSubmitting, setSnippetSubmitting] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSnippets = useCallback(async () => {
    setSnippetsLoading(true);
    try {
      const data = await catalog.devhub.snippets({ limit: 5 });
      // SDK returns { total, items }. Backend legacy used `snippets` —
      // accept either to stay tolerant of mixed deployments.
      const raw = data as unknown as { items?: Snippet[]; snippets?: Snippet[] };
      const list = Array.isArray(raw.items)
        ? raw.items
        : Array.isArray(raw.snippets)
          ? raw.snippets
          : [];
      setSnippets(list);
    } catch {
      setSnippetError("Failed to load snippets");
    } finally {
      setSnippetsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSnippets(); }, [fetchSnippets]);

  const submitSnippet = async () => {
    if (!snippetForm.title.trim() || !snippetForm.content.trim()) return;
    setSnippetSubmitting(true);
    setSnippetError(null);
    try {
      const tags = snippetForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await catalog.devhub.createSnippet({
        title: snippetForm.title.trim(),
        content: snippetForm.content,
        language: snippetForm.language.trim() || "plaintext",
        tags,
      });
      setSnippetForm({ title: "", language: "javascript", content: "", tags: "" });
      await fetchSnippets();
    } catch (e: any) {
      setSnippetError(e?.message || "Failed to share snippet");
    } finally {
      setSnippetSubmitting(false);
    }
  };

  const copySnippet = async (s: Snippet) => {
    try {
      await navigator.clipboard.writeText(s.content);
      setCopiedId(s.id);
      setTimeout(() => setCopiedId((c) => (c === s.id ? null : c)), 1600);
    } catch {
      setSnippetError("Clipboard unavailable");
    }
  };

  const removeSnippet = async (s: Snippet) => {
    const prev = snippets;
    setSnippets((arr) => arr.filter((x) => x.id !== s.id));
    try {
      const r = await fetch(apiUrl(`/api/devhub/snippets/${s.id}`), { method: "DELETE" });
      if (!r.ok) throw new Error(String(r.status));
    } catch {
      // Возврат обязателен: если снять не удалось, сниппет ОСТАЛСЯ на публичной
      // полке. Показать пустое место значило бы соврать — человек решит, что
      // убрал опубликованное, а оно на месте.
      setSnippets(prev);
      setSnippetError(t("snip.removeErr"));
    }
  };

  const starSnippet = async (s: Snippet) => {
    // Optimistic update.
    setSnippets((arr) =>
      arr.map((x) => (x.id === s.id ? { ...x, stars: x.stars + 1 } : x))
    );
    try {
      const data = await catalog.devhub.star(s.id);
      if (typeof data?.stars === "number") {
        setSnippets((arr) =>
          arr.map((x) => (x.id === s.id ? { ...x, stars: data.stars } : x))
        );
      }
    } catch {
      // Rollback.
      setSnippets((arr) =>
        arr.map((x) => (x.id === s.id ? { ...x, stars: Math.max(0, x.stars - 1) } : x))
      );
      setSnippetError(t("snip.starErr"));
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif", overflowX: "hidden" }}>
      {/* Замер посещения и ухода к оплате — см. components/PageTracking.
          До 14.08.2026 страница не считала НИЧЕГО, хотя ведёт к покупке. */}
      <PageTracking page="devhub" />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>
        <Wave1Nav />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              DevHub
            </h1>
            <p style={{ color: "#64748b", marginTop: 6, fontSize: 15 }}>
              {t("hero.sub")}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: "10px 22px", background: "#0d9488", color: "#fff",
              border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
              cursor: "pointer",
            }}
          >
            {t("project.new")}
          </button>
        </div>

        {/* Prompt-first entry — the product's front door: describe → built */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #134e4a 100%)",
          borderRadius: 16, padding: "28px 24px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            Опиши — и получи работающее приложение
          </div>
          <div style={{ fontSize: 13.5, color: "#99f6e4", marginBottom: 14, lineHeight: 1.5 }}>
            ИИ создаст проект, напишет код, покажет живое превью и диффы. Дальше — правь кликами
            (Visual Edit), проси изменения в чате, генерируй картинки и звук, деплой в один клик.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <textarea
              aria-label={t("hero.ideaAria")}
              value={ideaPrompt}
              onChange={(e) => setIdeaPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) startFromIdea(); }}
              placeholder={'Например: "трекер привычек с календарём и статистикой по неделям"'}
              style={{
                flex: "1 1 380px", minHeight: 56, padding: "12px 14px", border: "none",
                borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
              }}
            />
            <button
              onClick={startFromIdea}
              disabled={ideaStarting || !ideaPrompt.trim()}
              style={{
                padding: "0 26px", minHeight: 56, background: ideaStarting || !ideaPrompt.trim() ? "#134e4a" : "#0d9488",
                color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15,
                cursor: ideaStarting || !ideaPrompt.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {ideaStarting ? "Создаю…" : "⚡ Построить"}
            </button>
          </div>
          {/* An empty box is the hardest thing to answer. These are not
              decoration: each one exercises a different part of the pipeline
              (plain UI, a real database, media), so the first thing a person
              builds shows what the tool can do rather than the least of it. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, color: "#99f6e4" }}>Или начните с примера:</span>
            {[
              "лендинг кофейни с меню и формой брони",
              "трекер задач с базой данных и статусами",
              "портфолио фотографа с галереей и тёмной темой",
            ].map((example) => (
              <button
                key={example}
                onClick={() => setIdeaPrompt(example)}
                style={{
                  padding: "5px 11px", background: "rgba(255,255,255,0.12)", color: "#ccfbf1",
                  border: "1px solid rgba(255,255,255,0.22)", borderRadius: 999,
                  fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Studio Pro upgrade banner */}
        {userTier === "free" && (
          <div style={{
            background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
            borderRadius: 12, padding: "16px 20px", marginBottom: 20,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: 15, margin: 0 }}>
                {t("pro.title")}
              </p>
              <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" }}>
                {t("pro.perks")}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              <a
                href={STUDIO_PRO?.href ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                // Studio Pro sells through its own Lemon Squeezy variant, so the
                // charge never passes through /api/pricing/checkout — this event
                // is the only way it shows up in the funnel dashboard.
                onClick={() => track({ type: "checkout_start", tier: "studio-pro", source: "devhub", meta: { processor: "lemonsqueezy" } })}
                style={{
                  padding: "9px 20px", background: "#fff", color: "#0d9488",
                  borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Upgrade — {`$${STUDIO_PRO?.priceUsd ?? 149}`}/mo
              </a>
              <a
                href="/apps"
                style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", textDecoration: "underline", whiteSpace: "nowrap" }}
              >
                {t("pro.plans")}
              </a>
            </div>
          </div>
        )}

        {/* Visual Edit feature highlight */}
        <div style={{
          border: "1px solid #99f6e4", background: "#f0fdfa", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ maxWidth: 640 }}>
            <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>
              {t("ve.title")}
            </p>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>
              {t("ve.body")}
            </p>
          </div>
          <span style={{ padding: "6px 12px", background: "#0d9488", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
            {t("ve.where")}
          </span>
        </div>

        {/* Verified deploys + own subdomain highlight */}
        <div style={{
          border: "1px solid #ddd6fe", background: "#f5f3ff", borderRadius: 12,
          padding: "16px 20px", marginBottom: 20,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ maxWidth: 640 }}>
            <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>
              {t("dep.title")}
            </p>
            <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 0", lineHeight: 1.5 }}>
              {t("dep.body")}
            </p>
          </div>
          <span style={{ padding: "6px 12px", background: "#7c3aed", color: "#fff", borderRadius: 8, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>
            {t("dep.where")}
          </span>
        </div>

        {/* Live capability strip — honest state on the way in, not after the
            user has typed an idea and hit a dead button. Only rendered once
            the server has answered; silence is better than a guess. */}
        {caps.length > 0 && (() => {
          const off = caps.filter((c) => c.status !== "live");
          const live = caps.length - off.length;
          return (
            <div style={{
              border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12,
              padding: "12px 16px", marginBottom: 20, fontSize: 13, lineHeight: 1.6,
            }}>
              {/* «Настроено», а не «работает»: ручка /studio/capabilities отвечает на
                  вопрос «ключ задан», и это НЕ то же самое, что «проверено сейчас».
                  Замер 23.08.2026: среди «работающих» числился домен aevion.build,
                  которого не существует — реестр отвечает «Non-existent domain».
                  Слово «работает» превращало ответ одного вопроса в ответ другого. */}
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{t("caps.configured")}: {live} из {caps.length}</span>
              {off.length > 0 ? (
                <>
                  <span style={{ color: "#64748b" }}>{t("caps.off")}</span>
                  {off.map((c, i) => (
                    <span key={c.id} title={c.lastError || (c.status === "needs_token" ? "не настроено на сервере" : c.status)}>
                      <span style={{ color: "#92400e", borderBottom: "1px dotted #d97706", cursor: "help" }}>{c.name}</span>
                      {i < off.length - 1 ? <span style={{ color: "#64748b" }}>, </span> : null}
                    </span>
                  ))}
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                    {t("caps.note")}
                  </div>
                </>
              ) : (
                <span style={{ color: "#64748b" }}> · все интеграции отвечают</span>
              )}
            </div>
          );
        })()}

        {/* One window vs a stack of subscriptions — deliberately honest: the
            money gap is small and saying otherwise would be a lie. The claim
            we can defend is the handoffs, not the price. */}
        <div style={{
          border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12,
          padding: "18px 20px", marginBottom: 20,
        }}>
          <p style={{ fontWeight: 800, fontSize: 15, margin: 0, color: "#0f172a" }}>
            Одно окно вместо семи подписок
          </p>
          <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 12px", lineHeight: 1.55 }}>
            Приложение, база данных, тексты, картинки, озвучка, музыка, видео и 3D — в одном проекте,
            без переноса файлов между сервисами и без семи отдельных логинов.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
              <tbody>
                {[
                  ["Приложение по описанию", "Lovable Pro", "$25"],
                  ["Видео", "Runway Pro", "$35"],
                  ["Картинки", "Midjourney Standard", "$30"],
                  ["Озвучка", "ElevenLabs Creator", "$22"],
                  ["Музыка", "Suno", "$10"],
                  ["3D-модели", "Meshy Pro", "$20"],
                  ["Хостинг", "Vercel Pro", "$20"],
                ].map(([what, who, price]) => (
                  <tr key={what as string}>
                    <td style={{ padding: "3px 14px 3px 0", color: "#334155" }}>{what}</td>
                    <td style={{ padding: "3px 14px 3px 0", color: "#64748b" }}>{who}</td>
                    <td style={{ padding: "3px 0", color: "#334155", fontVariantNumeric: "tabular-nums" }}>{price}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "6px 14px 0 0", fontWeight: 800, color: "#0f172a", borderTop: "1px solid #e2e8f0" }}>Итого</td>
                  <td style={{ padding: "6px 14px 0 0", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>7 подписок, 7 логинов</td>
                  <td style={{ padding: "6px 0 0", fontWeight: 800, color: "#0f172a", borderTop: "1px solid #e2e8f0", fontVariantNumeric: "tabular-nums" }}>≈ $162</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "#64748b", margin: "12px 0 0", lineHeight: 1.5 }}>
            Цены — публичные тарифы сервисов на июль 2026. Мы не обещаем «в разы дешевле»:
            выигрыш здесь не в цене подписки, а в том, что результат одного шага сразу лежит
            в том же проекте, что и следующий.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#991b1b", fontSize: 14, display: "flex", justifyContent: "space-between" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: 700 }}>×</button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>{t("proj.loading")}</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: "center", padding: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏗</div>
            <h2 style={{ fontSize: 20, color: "#0f172a", marginBottom: 8 }}>{t("proj.empty")}</h2>
            <p style={{ color: "#64748b", marginBottom: 24 }}>{t("proj.emptyHint")}</p>
            <button
              onClick={() => setShowModal(true)}
              style={{ padding: "10px 24px", background: "#0d9488", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}
            >
              {t("project.new")}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
            {projects.map((p) => {
              const stackStyle = STACK_COLORS[p.stack] ?? { bg: "#64748b", fg: "#fff" };
              const statusStyle = STATUS_STYLES[p.status] ?? STATUS_STYLES.draft;
              return (
                <div
                  key={p.id}
                  style={{
                    background: "#fff", border: "1px solid rgba(15,23,42,0.1)",
                    borderRadius: 14, padding: "20px 22px", position: "relative",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {/* Stack + status row */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: stackStyle.bg, color: stackStyle.fg, fontSize: 12, fontWeight: 700 }}>
                      {STACK_LABELS[p.stack] ?? p.stack}
                    </span>
                    <span style={{ padding: "3px 10px", borderRadius: 6, background: statusStyle.bg, color: statusStyle.fg, fontSize: 12, fontWeight: 600 }}>
                      {statusStyle.label}
                    </span>
                    {p.needsRedeploy && (
                      <span
                        title={t("proj.stale")}
                        style={{ padding: "3px 10px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700 }}
                      >
                        ⟳ Redeploy needed
                      </span>
                    )}
                  </div>

                  <Link href={`/devhub/${p.id}`} style={{ textDecoration: "none" }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                      {p.name}
                    </h3>
                  </Link>
                  {p.description && (
                    <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  )}

                  {p.deployUrl && (
                    <a
                      href={fixDoubledScheme(p.deployUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#0d9488", display: "block", marginBottom: 12, wordBreak: "break-all" }}
                    >
                      {fixDoubledScheme(p.deployUrl)}
                    </a>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(p.updatedAt)}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Link
                        href={`/devhub/${p.id}`}
                        style={{ padding: "5px 14px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, color: "#0f172a", textDecoration: "none" }}
                      >
                        Open IDE
                      </Link>
                      <button
                        onClick={() => deleteProject(p.id)}
                        style={{ padding: "5px 10px", background: "none", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, color: "#ef4444", cursor: "pointer" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Snippet Shelf ───────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl bg-slate-950 text-slate-100 p-6 sm:p-8 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                {t("snip.title")}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                {t("snip.sub")}
              </p>
            </div>
            <button
              onClick={fetchSnippets}
              className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
            >
              Refresh
            </button>
          </div>

          {snippetError && (
            <div className="mb-4 rounded-md border border-rose-700 bg-rose-950/60 px-3 py-2 text-sm text-rose-200 flex justify-between">
              <span>{snippetError}</span>
              <button
                onClick={() => setSnippetError(null)}
                className="font-bold text-rose-200"
                aria-label="dismiss"
              >
                ×
              </button>
            </div>
          )}

          {snippetsLoading ? (
            <div className="text-center text-slate-500 py-10">{t("snip.loading")}</div>
          ) : snippets.length === 0 ? (
            <div className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-lg">
              {t("snip.empty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {snippets.map((s) => {
                const preview = (s.content || "").slice(0, 200);
                const truncated = (s.content || "").length > 200;
                return (
                  <div
                    key={s.id}
                    className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {s.title}
                      </h3>
                      <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-teal-900/60 text-teal-200 border border-teal-800">
                        {s.language || "plaintext"}
                      </span>
                    </div>

                    <pre className="text-[11px] font-mono leading-relaxed text-slate-300 bg-slate-950/60 border border-slate-800 rounded-md p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-words">
                      {preview}{truncated ? "…" : ""}
                    </pre>

                    {s.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.tags.slice(0, 6).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-800">
                      <button
                        onClick={() => starSnippet(s)}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200"
                        aria-label={`${t("snip.starAria")}: ${s.title}`}
                      >
                        <span aria-hidden>★</span>
                        <span>{s.stars}</span>
                      </button>
                      {s.mine && (
                        <button
                          onClick={() => removeSnippet(s)}
                          className="text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-rose-900/60 hover:border-rose-800 text-slate-300 hover:text-rose-200 transition-colors ml-auto mr-2"
                          aria-label={t("snip.removeAria")}
                        >
                          {t("snip.remove")}
                        </button>
                      )}
                      <button
                        aria-label={`${t("snip.copyAria")}: ${s.title}`}
                        onClick={() => copySnippet(s)}
                        className={
                          "text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors " +
                          (copiedId === s.id
                            ? "bg-emerald-900/60 border-emerald-700 text-emerald-200"
                            : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200")
                        }
                      >
                        {copiedId === s.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Share form */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              {t("snip.share")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={snippetForm.title}
                onChange={(e) =>
                  setSnippetForm((f) => ({ ...f, title: e.target.value }))
                }
                aria-label="Title"
                placeholder="Title"
                className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
              />
              <input
                type="text"
                value={snippetForm.language}
                onChange={(e) =>
                  setSnippetForm((f) => ({ ...f, language: e.target.value }))
                }
                aria-label={t("snip.phLang")}
                placeholder={t("snip.phLang")}
                className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
              />
            </div>
            <textarea
              value={snippetForm.content}
              onChange={(e) =>
                setSnippetForm((f) => ({ ...f, content: e.target.value }))
              }
              placeholder={t("snip.phCode")}
              aria-label={t("snip.codeAria")}
              rows={5}
              className="mt-3 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700 resize-y"
            />
            <input
              type="text"
              value={snippetForm.tags}
              onChange={(e) =>
                setSnippetForm((f) => ({ ...f, tags: e.target.value }))
              }
              aria-label={t("snip.phTags")}
              placeholder={t("snip.phTags")}
              className="mt-3 w-full px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
            />
            <div className="mt-4 flex justify-end">
              <button
                onClick={submitSnippet}
                disabled={
                  snippetSubmitting ||
                  !snippetForm.title.trim() ||
                  !snippetForm.content.trim()
                }
                className={
                  "px-4 py-2 rounded-md text-sm font-semibold transition-colors " +
                  (snippetSubmitting ||
                  !snippetForm.title.trim() ||
                  !snippetForm.content.trim()
                    ? "bg-teal-900/60 text-teal-300/60 cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-500 text-white")
                }
              >
                {snippetSubmitting ? t("snip.sharing") : t("snip.shareBtn")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: "20px clamp(16px, 4vw, 32px)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "#0f172a" }}>{t("modal.title")}</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Project Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                aria-label={t("modal.phName")}
                placeholder={t("modal.phName")}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box" }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Description
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                aria-label={t("modal.phDesc")}
                placeholder={t("modal.phDesc")}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16, boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Stack
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {STACKS.map((s) => {
                  const c = STACK_COLORS[s.id];
                  const selected = form.stack === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setForm((f) => ({ ...f, stack: s.id }))}
                      style={{
                        padding: "10px 14px", border: selected ? `2px solid ${c.bg}` : "2px solid #e2e8f0",
                        borderRadius: 10, background: selected ? `${c.bg}15` : "#fff",
                        textAlign: "left", cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13, color: selected ? c.bg : "#374151" }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ padding: "9px 18px", background: "#f1f5f9", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", color: "#374151" }}
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={creating || !form.name.trim()}
                style={{
                  padding: "9px 22px", background: creating ? "#99f6e4" : "#0d9488",
                  color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
