"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAdoptPreHydrationValues } from "@/lib/useAdoptPreHydrationValues";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { СОБЫТИЕ_ПЕРЕНОСА } from "@/components/DevHubGuestIdentity";
import { apiUrl } from "@/lib/apiBase";
import { useDevhubT } from "./i18n";
import { catalog } from "@/lib/aevionCatalog";
import { fixDoubledScheme } from "@/lib/urls";
import { track } from "@/lib/track";
import { productById } from "@/lib/products";
import { PageTracking } from "@/components/PageTracking";
import { devhubServerError } from "@/lib/devhubServerError";
import { stackForIdea } from "@/lib/devhubStackChoice";

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

// label — ключ словаря, а не текст: константа живёт вне компонента, где t()
// недоступен; перевод происходит на рендере.
const STATUS_STYLES: Record<ProjectStatus, { bg: string; fg: string; label: "status.draft" | "status.building" | "status.live" | "status.failed" }> = {
  draft: { bg: "#f1f5f9", fg: "#64748b", label: "status.draft" },
  building: { bg: "#fef3c7", fg: "#92400e", label: "status.building" },
  live: { bg: "#d1fae5", fg: "#065f46", label: "status.live" },
  error: { bg: "#fee2e2", fg: "#991b1b", label: "status.failed" },
};

const STACKS = [
  { id: "next", label: "Next.js", desc: "stack.next" },
  { id: "express", label: "Express", desc: "stack.express" },
  { id: "static", label: "Static", desc: "stack.static" },
  { id: "react", label: "React SPA", desc: "stack.react" },
  { id: "python", label: "Python", desc: "stack.python" },
] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  // Локаль БРАУЗЕРА, а не "en-US". Здесь была зашита американская: на русской
  // странице даты выглядели как «Aug 28, 2026». В двух других местах модуля
  // локаль уже берётся от браузера — то есть один и тот же модуль показывал
  // даты в двух форматах, и это заметно рядом.
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Price and checkout URL come from the product catalogue, which is verified
// against the live payment dashboards — the page must not carry its own copy.
const STUDIO_PRO = productById("devhub");

/**
 * Почему возможность отключена — словами человека.
 *
 * Раньше тут было `c.status === "needs_token" ? "не настроено на сервере" : c.status`,
 * то есть для ЛЮБОГО другого состояния на экран уходил машинный токен. После
 * того как домен aevion.build стал «not_available» (зона не делегирована),
 * человек, наведя курсор, прочитал бы ровно `not_available`.
 *
 * «Нет ключа» и «не сделано» — разные вещи, и человеку полезно различать: первое
 * мы настроим, второе ещё не существует.
 */
/** Названия возможностей для строки остатка. Отдельной картой, а не через
 *  словарь: ключи приходят от сервера, а `t()` типизирован фиксированным
 *  набором — динамический ключ там не проходит проверку типов, и это верно. */
const USAGE_LABEL: Record<string, string> = {
  video: "видео",
  image: "картинки",
  tts: "знаков озвучки",
  music: "музыка",
  deploy: "выкаток",
  // Заведены 02.09.2026 вместе с квотой на речь и перевод. Без подписи экран
  // показал бы СЫРОЙ КЛЮЧ (`USAGE_LABEL[k] ?? k`) — английское машинное слово
  // на русском экране. Заводя ключ возможности, заводи и подпись: запасная
  // ветка `?? k` не падает и не краснеет, она просто печатает жаргон.
  speech: "распознаваний и клонов голоса",
  translate: "переводов",
  generate: "генераций кода",
};

function capabilityOffReason(status: string | undefined): string {
  switch (status) {
    case "needs_token":
      return "не настроено на сервере — подключим";
    case "not_available":
      return "пока не сделано, а не «забыли ключ»";
    case "error":
      return "провайдер отвечает ошибкой";
    case undefined:
    case "":
      return "состояние неизвестно";
    default:
      // Незнакомое состояние показываем как есть — прятать хуже, чем показать
      // непонятное: иначе ни человек, ни мы не поймём, о чём речь.
      return `состояние: ${status}`;
  }
}

export default function DevHubPage() {
  const t = useDevhubT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<"free" | "pro" | "enterprise" | null>(null);
  // Ручка остатка отдаёт и ЧИСЛА (`usage: {video:{used,limit}, ...}`), а витрина
  // брала из ответа только тариф. То есть модуль знал, сколько у человека
  // осталось, и не говорил — предел человек узнавал, упершись в него.
  const [usage, setUsage] = useState<Record<string, { used: number; limit: number }> | null>(null);
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
      // Выбор стека вынесен в lib/devhubStackChoice (там сторож): на нём
      // держится обещание «правьте кликами» с витрины.
      const stack = stackForIdea(idea);
      const r = await fetch(apiUrl("/api/devhub/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: idea, stack }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(devhubServerError(data.error, t("err.create")));
      // Сервер честно говорит, КУДА лёг проект, и до сегодня это поле никто не
      // читал: правда доезжала до ответа и останавливалась на границе API.
      // «memory» значит, что база была недоступна и запись живёт в памяти
      // процесса — исчезнет при перезапуске. Человек должен узнать это сейчас,
      // а не обнаружить пропажу завтра.
      if (data.storage === "memory") setError(t("proj.savedToMemory"));
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
      setError(t("err.projLoad"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Перенос гостевой работы в аккаунт идёт ПАРАЛЛЕЛЬНО первой загрузке списка
  // (оба из useEffect на монтировании), поэтому список успевает уехать пустым.
  // Дождаться переноса синхронно нельзя — он в соседнем компоненте; поэтому он
  // оповещает, а мы перечитываем. Событие приходит ТОЛЬКО когда что-то реально
  // переехало, так что лишнего запроса у обычного посетителя не будет.
  useEffect(() => {
    const onAdopted = () => { fetchProjects(); };
    window.addEventListener(СОБЫТИЕ_ПЕРЕНОСА, onAdopted);
    return () => window.removeEventListener(СОБЫТИЕ_ПЕРЕНОСА, onAdopted);
  }, [fetchProjects]);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setCaps(Array.isArray(d.capabilities) ? d.capabilities : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/credits"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d.tier) setUserTier(d.tier); if (d.usage) setUsage(d.usage); })
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
      if (!r.ok) throw new Error(devhubServerError(data.error, "Не удалось создать проект"));
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
      const r = await fetch(apiUrl(`/api/devhub/projects/${id}`), { method: "DELETE" });
      if (!r.ok) {
        // The server refuses this on purpose when the project's database or
        // its Railway service could not be removed — dropping the card here
        // would hide a schema, a login role and a billable container that are
        // all still live, with nothing left pointing at them.
        const d = await r.json().catch(() => null);
        setError(devhubServerError(d?.error, `Проект не удалён — сервер ответил ${r.status}`));
        return;
      }
      setProjects((ps) => ps.filter((p) => p.id !== id));
    } catch {
      // Было английское «Delete failed» посреди русской страницы, и оно не
      // говорило главного: проект НЕ удалён, повторить безопасно.
      setError("Не удалось связаться с сервером. Проект не удалён — попробуйте ещё раз.");
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

  // Painted is not the same as working: measured 28.07 on a mid-range phone
  // (CPU x6, 1.6 Mbps), the live shelf paints at 6.9s and only answers a tap
  // at 18.7s. For those ~12 seconds every control here looked ready and did
  // nothing. Say so instead.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Anything typed into either form before hydration lives only in the DOM;
  // adopt it on mount so the first data-driven re-render does not wipe it.
  const ideaFieldRef = useRef<HTMLDivElement>(null);
  const snippetFormRef = useRef<HTMLDivElement>(null);
  useAdoptPreHydrationValues(
    ideaFieldRef,
    useCallback((typed: Record<string, string>) => {
      if (typed.ideaPrompt) setIdeaPrompt(typed.ideaPrompt);
    }, []),
  );
  useAdoptPreHydrationValues(
    snippetFormRef,
    useCallback((typed: Record<string, string>) => {
      setSnippetForm((f) => ({ ...f, ...typed }));
    }, []),
  );
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
      setSnippetError(t("err.snipLoad"));
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
      setSnippetError(e?.message || t("err.snipShare"));
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
      setSnippetError(t("err.clipboard"));
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
            {t("hero.title")}
          </div>
          <div style={{ fontSize: 13.5, color: "#99f6e4", marginBottom: 14, lineHeight: 1.5 }}>
                {/* Порядок здесь — обещание, а не украшение: Visual Edit у стека
                    по умолчанию включается ПОСЛЕ деплоя, и обещать правку кликами
                    первой строкой значит отправить человека искать кнопку, которой
                    ещё нет. Текст исправлен в словаре (hero.subtitle), а не зашит
                    сюда: строка показывается на трёх языках. */}
                {t("hero.subtitle")}
          </div>
          <div ref={ideaFieldRef} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {/* Оба атрибута нужны, и это не компромисс при сведении:
                признак гидратации читает сторож предзаполнения, доступное имя —
                читалка экрана. Взять одну сторону значило бы молча потерять
                другую, и потеря была бы невидимой: поле работает в обоих
                случаях, а теряется либо проверка, либо доступность.

                Подпись идёт через словарь, а не строкой: страница переводится
                (70 вызовов t), и жёсткий русский текст здесь читалка озвучила бы
                по-русски на английском интерфейсе. Текст пришёл при сведении —
                соседнее окно добавляло доступное имя, я взял его как есть. */}
            <textarea
              data-prehydration-field="ideaPrompt"
              aria-label={t("hero.ideaAria")}
              value={ideaPrompt}
              onChange={(e) => setIdeaPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) startFromIdea(); }}
              placeholder={t("hero.placeholder")}
              style={{
                flex: "1 1 380px", minHeight: 56, padding: "12px 14px", border: "none",
                borderRadius: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box",
              }}
            />
            <button
              onClick={startFromIdea}
              disabled={!hydrated || ideaStarting || !ideaPrompt.trim()}
              style={{
                padding: "0 26px", minHeight: 56, background: !hydrated || ideaStarting || !ideaPrompt.trim() ? "#134e4a" : "#0d9488",
                color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 15,
                cursor: !hydrated || ideaStarting || !ideaPrompt.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
                  {!hydrated ? t("hero.loading") : ideaStarting ? t("hero.building") : t("hero.build")}
            </button>
          </div>
          {/* An empty box is the hardest thing to answer. These are not
              decoration: each one exercises a different part of the pipeline
              (plain UI, a real database, media), so the first thing a person
              builds shows what the tool can do rather than the least of it. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: "#99f6e4" }}>{t("store.orExample")}</span>
            {[
              t("hero.ex1"),
              t("hero.ex2"),
              t("hero.ex3"),
            ].map((example) => (
              <button
                key={example}
                onClick={() => setIdeaPrompt(example)}
                disabled={!hydrated}
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

        {/* ОСТАТОК ЗА МЕСЯЦ. Модуль знал числа и молчал: человек упирался в предел,
            не подозревая о нём. Показываем только то, у чего предел ЕСТЬ (-1 значит
            без предела — про такое говорить нечего) и только когда данные пришли:
            выдумывать «0 из 0» при неответившей ручке хуже, чем не показать ничего. */}
        {usage && (
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px",
            marginBottom: 16, fontSize: 13, color: "#334155", background: "#f8fafc",
          }}>
            <span style={{ fontWeight: 600 }}>{t("usage.title")}</span>{" "}
            {Object.entries(usage)
              .filter(([, v]) => v && v.limit > 0)
              .map(([k, v]) => {
                const left = Math.max(0, v.limit - v.used);
                const tight = left <= Math.max(1, Math.floor(v.limit * 0.2));
                return (
                  <span key={k} style={{ marginRight: 12, color: tight ? "#b45309" : "#334155" }}>
                    {USAGE_LABEL[k] ?? k}: <b>{left}</b> из {v.limit}
                  </span>
                );
              })}
          </div>
        )}

        {/* Studio Pro upgrade banner.
            Показывается и при НЕИЗВЕСТНОМ тарифе (ручка кредитов не ответила):
            раньше условие было строго `=== "free"`, и один упавший запрос
            прятал единственный денежный экран модуля — ни цены, ни кнопки,
            ни входа в подключение покупки. Плативший увидит баннер на долю
            секунды до ответа ручки — это дешевле, чем гость без кассы. */}
        {userTier !== "pro" && userTier !== "enterprise" && (
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
              {/* Кнопки НЕТ, если товара нет в каталоге.
                  Раньше стояло `href={STUDIO_PRO?.href ?? "#"}`: при пропаже записи
                  человек видел бы «Upgrade — $149/mo», нажимал и не попадал никуда.
                  Хуже мёртвой кнопки было второе: событие «начал оплату» уходило
                  ВСЁ РАВНО, и в воронке появлялись начатые оплаты, которых не было —
                  то есть отчёт о деньгах врал бы правдоподобно.
                  Цена берётся только из каталога: зашитая рядом «149» — второй
                  источник, который однажды разойдётся с настоящей ценой. */}
              {STUDIO_PRO ? (
              <a
                href={STUDIO_PRO.href}
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
                {t("pro.upgrade")} — {`$${STUDIO_PRO.priceUsd}`}{t("pro.perMonth")}
              </a>
              ) : (
                <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: 600 }}>
                  {t("pro.unavailable")}
                </span>
              )}
              {/* Правда, которая нужна человеку ДО оплаты, а не после.
                  Модуль работает без аккаунта, а оплата приходит нам с одним
                  лишь адресом почты: если человек не войдёт с тем же адресом,
                  он заплатит $149 и увидит бесплатный тариф. Замер 29.08.2026
                  на живом проде это подтвердил.
                  Строка верна при ЛЮБОМ из трёх способов починки, поэтому
                  добавлена не дожидаясь выбора: механизм придёт позже, а
                  терять деньги человек может уже сегодня. */}
              <span style={{ color: "rgba(255,255,255,0.75)", fontSize: 11.5, lineHeight: 1.45, maxWidth: 260, textAlign: "right" }}>
                {t("pro.emailNote")}
              </span>

              {/* Вход в подключение уже совершённой покупки. Без этой ссылки
                  ручки связывания работают, а дойти до них человеку неоткуда:
                  письма после оплаты мы не шлём, магазин про нас не знает. */}
              <Link
                href="/devhub/link"
                style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5, textDecoration: "underline" }}
              >
                {t("pro.linkPurchase")}
              </Link>

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
              <span style={{ fontWeight: 700, color: "#0f172a" }}>{t("caps.configured")}: {live} {t("caps.of")} {caps.length}</span>
              {off.length > 0 ? (
                <>
                  <span style={{ color: "#64748b" }}>{t("caps.off")}</span>
                  {/* ПОПРАВЛЕНО 30.08.2026: прежний текст говорил, что настоящие ошибки
                        сюда НЕ подключены и это «отдельная работа». Подключены.
                        Ручка применяет applyHealth к каждой возможности: если
                        поставщик недавно отказал, статус понижается с live до
                        degraded, а причина кладётся в lastError. Сюда она и
                        приходит подсказкой; запасная ветка нужна только когда
                        отказов не было.

                        Проверено прогоном, а не чтением: отказ поставщика даёт
                        degraded с причиной, успех статус не трогает.

                        Комментарий, утверждающий состояние, стареет как отчёт, а
                        тестов у него нет — этот пролежал устаревшим и говорил
                        следующему читателю делать сделанное. */}
                  {off.map((c, i) => (
                    <span key={c.id} title={c.lastError || capabilityOffReason(c.status)}>
                      <span style={{ color: "#92400e", borderBottom: "1px dotted #d97706", cursor: "help" }}>{c.name}</span>
                      {i < off.length - 1 ? <span style={{ color: "#64748b" }}>, </span> : null}
                    </span>
                  ))}
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                    {t("caps.note")}
                  </div>
                </>
              ) : (
                <span style={{ color: "#64748b" }}>{t("caps.allRespond")}</span>
              )}
              {/* The comparison belongs next to the live state, not on a
                  marketing page: both answer the same question — what is real
                  right now — and the strip is what makes the table checkable. */}
              <div style={{ marginTop: 8, fontSize: 12.5 }}>
                <Link href="/compare" style={{ color: "#0d9488", fontWeight: 700, textDecoration: "none" }}>
                  Как мы выглядим рядом с Bolt, Lovable, v0 и Replit →
                </Link>
                <span style={{ color: "#94a3b8" }}>{t("store.withSourceNote")}</span>
              </div>
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
            {t("value.title")}
          </p>
          <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 12px", lineHeight: 1.55 }}>
            {t("value.body")}

          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
              <tbody>
                {[
                  [t("cmp.app"), "Lovable Pro", "$25"],
                  [t("cmp.video"), "Runway Pro", "$35"],
                  [t("cmp.images"), "Midjourney Standard", "$30"],
                  [t("cmp.voice"), "ElevenLabs Creator", "$22"],
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
                  <td style={{ padding: "6px 14px 0 0", fontWeight: 800, color: "#0f172a", borderTop: "1px solid #e2e8f0" }}>{t("store.total")}</td>
                  <td style={{ padding: "6px 14px 0 0", color: "#64748b", borderTop: "1px solid #e2e8f0" }}>{t("store.subsLogins")}</td>
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

        {/* Проекты гостя привязаны к ЭТОМУ БРАУЗЕРУ: личность лежит в
            localStorage (lib/devhubGuest.ts). Очистил хранилище, открыл другой
            браузер — проекты остались на сервере, но человек их больше не
            видит, и вернуть их нечем.

            Витрина при этом зовёт работать без аккаунта («No GitHub or cloud
            accounts needed») и об этой цене не говорила НИГДЕ. Пригласить и
            умолчать — то же самое, что обещать лишнее, только наоборот.

            Строка показывается всем: страница о входе не знает вовсе, а
            заводить здесь состояние авторизации ради одной подсказки — правка
            крупнее самой пользы. Для вошедшего она просто не про него. */}
        <p
          style={{
            fontSize: 12.5, color: "#64748b", margin: "0 0 14px",
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          }}
        >
          <span aria-hidden="true">💾</span>
          {t("proj.browserBound")}
        </p>

        {/* Loading */}
        {/* Each branch carries its own key. Without them React reconciles these
            by position, and when a late fetch flips the branch it remounts the
            siblings below — including the snippet form, so anyone typing in it
            during load lost what they had written. */}
        {loading ? (
          <div key="projects-loading" style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>{t("proj.loading")}</div>
        ) : projects.length === 0 ? (
          <div key="projects-empty" style={{ textAlign: "center", padding: 80 }}>
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
          <div key="projects-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: 20 }}>
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
                      {t(statusStyle.label)}
                    </span>
                    {p.needsRedeploy && (
                      <span
                        title={t("proj.stale")}
                        style={{ padding: "3px 10px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 700 }}
                      >
                        {t("proj.redeploy")}
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
                        {t("proj.openIde")}
                      </Link>
                      <button
                        onClick={() => deleteProject(p.id)}
                        style={{ padding: "5px 10px", background: "none", border: "1px solid #fca5a5", borderRadius: 7, fontSize: 12, color: "#ef4444", cursor: "pointer" }}
                      >
                        {t("proj.delete")}
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
              {t("snip.refresh")}
            </button>
          </div>

          {snippetError && (
            <div className="mb-4 rounded-md border border-rose-700 bg-rose-950/60 px-3 py-2 text-sm text-rose-200 flex justify-between">
              <span>{snippetError}</span>
              <button
                onClick={() => setSnippetError(null)}
                className="font-bold text-rose-200"
                aria-label={t("a11y.dismiss")}
              >
                ×
              </button>
            </div>
          )}

          {snippetsLoading ? (
            <div key="snippets-loading" className="text-center text-slate-500 py-10">{t("snip.loading")}</div>
          ) : snippets.length === 0 ? (
            <div key="snippets-empty" className="text-center text-slate-500 py-10 border border-dashed border-slate-800 rounded-lg">
              {t("snip.empty")}
            </div>
          ) : (
            <div key="snippets-grid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                          aria-label={`${t("snip.removeAria")}: ${s.title}`}
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
                        {copiedId === s.id ? t("snip.copied") : t("snip.copy")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Share form */}
          <div ref={snippetFormRef} className="mt-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              {t("snip.share")}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                data-prehydration-field="title"
              value={snippetForm.title}
                onChange={(e) =>
                  setSnippetForm((f) => ({ ...f, title: e.target.value }))
                }
                aria-label="Title"
                placeholder={t("field.title")}                className="px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-700"
              />
              <input
                type="text"
                data-prehydration-field="language"
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
              data-prehydration-field="content"
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
              data-prehydration-field="tags"
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
          // Clicking the backdrop already closed this; Escape did nothing, so a
          // keyboard had no way out of the dialog at all.
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setShowModal(false); } }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="devhub-new-project-title"
            style={{ background: "#fff", borderRadius: 16, padding: "20px clamp(16px, 4vw, 32px)", width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
          >
            <h2 id="devhub-new-project-title" style={{ fontSize: 20, fontWeight: 800, marginBottom: 20, color: "#0f172a" }}>{t("modal.title")}</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                {t("modal.name")}
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
                {t("modal.desc")}
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
                {t("modal.stack")}
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
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{t(s.desc)}</div>
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
                {t("modal.cancel")}
              </button>
              <button
                onClick={createProject}
                disabled={creating || !form.name.trim()}
                style={{
                  padding: "9px 22px", background: creating ? "#99f6e4" : "#0d9488",
                  color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? t("modal.creating") : t("modal.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
