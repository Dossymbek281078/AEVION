"use client";

/**
 * AgentDock — a global floating "AI Agent" widget mounted on every product /
 * module page (see ClientProviders). It talks to our OWN agent runtime
 * (POST /api/agent-runtime/run): a real Anthropic tool-use loop that can create
 * images, voice/music, payment links, send email/SMS, translate, and call any
 * connected remote-MCP tool — without leaving the current page.
 *
 * Self-contained and additive: it holds its own state, uses the prod-safe
 * apiUrl() helper only inside the click handler (never in render → no hydration
 * mismatch), and renders nothing on the server beyond an inert launcher button.
 */

import { AiBadge } from "@/components/AiBadge";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";
import { useI18nOptional } from "@/lib/i18n";
import {
  buildRunRequest,
  canSend,
  describeToolActivity,
  extractDevHubProjectId,
  summarizeRun,
  summarizeHealth,
  prettyToolName,
  AGENT_EVENT_NAME,
  type AgentEventDetail,
  type DockRunResponse,
  type DockHealth,
  type DockToolSummary,
  type ToolActivity,
} from "./agentDock.lib";

interface ChatEntry {
  role: "user" | "agent";
  text: string;
  activity?: ToolActivity[];
  error?: boolean;
}

const DARK = "#0f172a";
const PANEL_BG = "linear-gradient(160deg, #0f172a 0%, #131f38 100%)";

function ToolChips({ title, names, tone }: { title: string; names: string[]; tone: "native" | "mcp" }) {
  if (names.length === 0) return null;
  const color = tone === "mcp" ? "#bbf7d0" : "#c7d2fe";
  const border = tone === "mcp" ? "#166534" : "#3a4a6b";
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 9, color: "#64748b", fontWeight: 800, letterSpacing: 0.4, marginBottom: 4 }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {names.map((n) => (
          <span
            key={n}
            title={n}
            style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color, background: "rgba(255,255,255,0.04)", border: `1px solid ${border}` }}
          >
            {prettyToolName(n)}
          </span>
        ))}
      </div>
    </div>
  );
}


/**
 * Подписи помощника на языке посетителя. 20.10.2026 (замер /devhub, 3 локали):
 * виджет стоит на КАЖДОЙ странице и смешивал языки при любом выборе — кнопка
 * «AI Agent», «Send», подсказки и поле по-английски, aria-label по-русски.
 */
const DOCK = {
  ru: {
    open: "Открыть ИИ-помощника AEVION",
    label: "ИИ-помощник",
    panel: "ИИ-помощник AEVION",
    title: "Помощник AEVION",
    toolsShow: "Показать доступные инструменты",
    tools: "Доступные инструменты",
    collapse: "Свернуть помощника",
    hintProject: "Попросите что угодно — я выберу нужный инструмент. Например: «добавь в проект страницу входа», «сделай 10-секундный лоу-фай трек» или «создай ссылку на оплату консультации $25».",
    hint: "Попросите что угодно — я выберу нужный инструмент. Например: «сделай 10-секундный лоу-фай трек», «переведи это на казахский» или «создай ссылку на оплату консультации $25».",
    working: "Работаю…",
    placeholder: "Попросите помощника что-нибудь сделать…",
    input: "Сообщение ИИ-помощнику",
    send: "Отправить",
    caps: "картинки · голос · музыка · оплата · почта · SMS · перевод",
    capsCode: "код · картинки · голос · музыка · оплата · почта · SMS · перевод",
  },
  en: {
    open: "Open the AEVION AI assistant",
    label: "AI Agent",
    panel: "AEVION AI assistant",
    title: "AEVION Agent",
    toolsShow: "Show available tools",
    tools: "Available tools",
    collapse: "Collapse the assistant",
    hintProject: "Ask for anything and I'll use the right tool — e.g. “add a login page to this project”, “make a 10-second lofi music clip”, or “create a $25 payment link for a consult”.",
    hint: "Ask for anything and I'll use the right tool — e.g. “make a 10-second lofi music clip”, “translate this to Kazakh”, or “create a $25 payment link for a consult”.",
    working: "Working…",
    placeholder: "Ask the agent to do something…",
    input: "Message to the AI assistant",
    send: "Send",
    caps: "image · voice · music · pay · email · SMS · translate",
    capsCode: "code · image · voice · music · pay · email · SMS · translate",
  },
  kk: {
    open: "AEVION ЖИ-көмекшісін ашу",
    label: "ЖИ-көмекші",
    panel: "AEVION ЖИ-көмекшісі",
    title: "AEVION көмекшісі",
    toolsShow: "Қолжетімді құралдарды көрсету",
    tools: "Қолжетімді құралдар",
    collapse: "Көмекшіні жию",
    hintProject: "Кез келген нәрсені сұраңыз — қажетті құралды өзім таңдаймын. Мысалы: «жобаға кіру бетін қос», «10 секундтық лоу-фай трек жаса» немесе «$25 кеңеске төлем сілтемесін жаса».",
    hint: "Кез келген нәрсені сұраңыз — қажетті құралды өзім таңдаймын. Мысалы: «10 секундтық лоу-фай трек жаса», «мұны қазақшаға аудар» немесе «$25 кеңеске төлем сілтемесін жаса».",
    working: "Орындалуда…",
    placeholder: "Көмекшіден бірдеңе жасауды сұраңыз…",
    input: "ЖИ-көмекшіге хабарлама",
    send: "Жіберу",
    caps: "суреттер · дауыс · музыка · төлем · пошта · SMS · аударма",
    capsCode: "код · суреттер · дауыс · музыка · төлем · пошта · SMS · аударма",
  },
} as const;
type DockLang = keyof typeof DOCK;

export function AgentDock() {
  const dockLang = useI18nOptional()?.lang;
  const D = DOCK[(dockLang && dockLang in DOCK ? dockLang : "en") as DockLang];
  const pathname = usePathname();
  const projectId = extractDevHubProjectId(pathname || "");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ChatEntry[]>([]);
  const [health, setHealth] = useState<DockToolSummary | null>(null);
  const [showTools, setShowTools] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const send = async (explicit?: string) => {
    const message = explicit ?? input;
    if (!canSend(message) || busy) return;
    setInput("");
    setLog((l) => [...l, { role: "user", text: message.trim() }]);
    setBusy(true);
    scrollToEnd();
    try {
      const r = await fetch(apiUrl("/api/agent-runtime/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRunRequest(message, undefined, projectId)),
      });
      const data = (await r.json().catch(() => ({}))) as DockRunResponse;
      if (!r.ok || data.ok === false) {
        setLog((l) => [...l, { role: "agent", text: summarizeRun(data) || `Error ${r.status}`, error: true }]);
      } else {
        setLog((l) => [
          ...l,
          {
            role: "agent",
            text: data.finalText || summarizeRun(data),
            activity: describeToolActivity(data.transcript),
          },
        ]);
      }
    } catch (e) {
      setLog((l) => [...l, { role: "agent", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  };

  // Keep a live ref to send so the (empty-deps) global listener never fires a
  // stale closure over busy/input.
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const sendRef = useRef(send);
  sendRef.current = send;

  // Кнопка агента закреплена в правом нижнем углу и накрывает последнюю
  // строку подвала: замер 02.09.2026 на проде — ссылка «Помощь» -> /help
  // недостижима на 40 адресах, прокрутка не спасает (подвал и так внизу).
  //
  // Публикуем высоту кнопки, чтобы подвал на неё отступил. Тот же приём уже
  // работает в обратную сторону: баннер установки публикует свою высоту, а
  // эта кнопка на неё отступает.
  useEffect(() => {
    const кнопка = launcherRef.current;
    const корень = document.documentElement;
    if (!кнопка) {
      // Кнопки нет (док открыт) — переменную снимаем, иначе подвал держит
      // отступ под то, чего на экране уже нет.
      корень.style.removeProperty("--aevion-agent-h");
      return;
    }
    const обновить = () => {
      const h = кнопка.getBoundingClientRect().height;
      if (h > 0) корень.style.setProperty("--aevion-agent-h", `${Math.round(h) + 24}px`);
    };
    обновить();
    // В тестовой среде ResizeObserver отсутствует. Отступ уже выставлен выше;
    // без сторожа размера компонент не должен падать целиком.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(обновить);
    ro.observe(кнопка);
    return () => ro.disconnect();
  }, [open]);

  // Any page can dispatch AGENT_EVENT_NAME to open + prefill (± auto-send) the
  // dock — e.g. the per-module prompt chips on /[id].
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AgentEventDetail>).detail;
      if (!detail || typeof detail.prompt !== "string") return;
      setOpen(true);
      setInput(detail.prompt);
      if (detail.autoSend) void sendRef.current(detail.prompt);
    };
    window.addEventListener(AGENT_EVENT_NAME, handler as EventListener);
    return () => window.removeEventListener(AGENT_EVENT_NAME, handler as EventListener);
  }, []);

  // Fetch the runtime's capabilities the first time the dock is opened, so the
  // user can see exactly what the agent can do (native + connected MCP tools).
  useEffect(() => {
    if (!open || health) return;
    let alive = true;
    fetch(apiUrl("/api/agent-runtime/health"))
      .then((r) => (r.ok ? (r.json() as Promise<DockHealth>) : null))
      .then((h) => {
        if (alive && h) setHealth(summarizeHealth(h));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, health]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  // Кнопка стоит в правом нижнем углу и НАВСЕГДА закрывала ссылку
  // «Помощь» в подвале: внизу страницы уехать из-под неё некуда.
  // Замер живого прода 28.08.2026 зондом aevion-overlay-probe, десктоп
  // 1280px. Поэтому кнопка публикует свой след, а страница на него
  // отступает — так же, как под баннер установки.
  useEffect(() => {
    const root = document.documentElement;
    if (open) {
      root.style.removeProperty("--aevion-dock-h");
      return;
    }
    const h = launcherRef.current?.getBoundingClientRect().height ?? 0;
    root.style.setProperty("--aevion-dock-h", `${Math.round(h) + 12}px`);
    return () => {
      root.style.removeProperty("--aevion-dock-h");
    };
  }, [open]);

  // ── Launcher button (collapsed) ────────────────────────────────────
  if (!open) {
    return (
      <>
      {/* На телефоне кнопка остаётся ЗНАЧКОМ без подписи.
          Замер 30.09.2026 на 390 px: «✦ AI Агент» — 113×46 в правом нижнем
          углу (20 px от низа), то есть она накрывает правый край любой нижней
          строки, включая кнопки покупки в карточках приложений. Значок 46×46
          перекрывает втрое меньше, а доступное имя (aria-label) остаётся тем
          же, поэтому для скринридера ничего не меняется.
          Прячем подпись медиазапросом, а не замером ширины в JS: кнопка живёт
          на всех страницах, и перерисовка после гидрации была бы заметна. */}
      <style>{`
        @media (max-width: 700px) {
          .aev-agent-label { display: none; }
          .aev-agent-launcher { padding: 12px !important; gap: 0 !important; }
        }
      `}</style>
      <button
        onClick={() => setOpen(true)}
        ref={launcherRef}
        className="aev-agent-launcher"
        aria-label={D.open}
        style={{
          position: "fixed",
          // Отступаем на высоту баннера установки, если он показан: они стоят в
          // одном углу, и баннер (z-index 9999) полностью накрывал эту кнопку —
          // замер 28.08.2026: 0 доступных точек из 70. Переменную публикует
          // InstallPrompt; нет баннера — нет переменной, отступ обычный.
          bottom: "calc(16px + var(--aevion-install-h, 0px))",
          right: 16,
          zIndex: 9998,
          padding: "10px 16px",
          borderRadius: 999,
          border: "1px solid #334155",
          background: "linear-gradient(135deg, #6366f1, #06b6d4)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: 0.3,
          cursor: "pointer",
          boxShadow: "0 8px 24px rgba(15,23,42,0.5)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        <span className="aev-agent-label">{D.label}</span>
      </button>
      </>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-label={D.panel}
      // Роль на самой панели: без пометки правило окон из globals.css (≤768)
      // делало fixed все три её блока — на 390 панель была пустой (23.10).
      data-dialog-panel
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9998,
        width: "min(380px, calc(100vw - 32px))",
        height: "min(560px, calc(100vh - 32px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        overflow: "hidden",
        background: PANEL_BG,
        border: "1px solid #334155",
        boxShadow: "0 16px 48px rgba(15,23,42,0.6)",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: "1px solid #24314d",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span style={{ fontSize: 16 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>{D.title}</div>
          <div style={{ fontSize: 10, color: "#8aa0c6" }}>
            {projectId ? D.capsCode : D.caps}
          </div>
        </div>
        {health && (
          <button
            onClick={() => setShowTools((v) => !v)}
            aria-label={D.toolsShow}
            title={D.tools}
            style={{
              padding: "4px 9px",
              borderRadius: 999,
              border: "1px solid #3a4a6b",
              background: showTools ? "rgba(99,102,241,0.25)" : "transparent",
              color: "#c7d2fe",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🧰 {health.total}{health.mcp.length ? ` · ${health.mcp.length} MCP` : ""}
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          aria-label={D.collapse}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid #3a4a6b",
            background: "transparent",
            color: "#93a6c9",
            fontSize: 12,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ▾
        </button>
      </div>

      {/* available-tools panel */}
      {showTools && health && (
        <div style={{ padding: "10px 12px", borderBottom: "1px solid #24314d", background: "rgba(99,102,241,0.06)", maxHeight: 180, overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "#8aa0c6", marginBottom: 6 }}>
            {health.model ? `Model ${health.model}` : "Agent"} · {health.keyConfigured ? "connected" : "no key"} · {health.total} tools
          </div>
          <ToolChips title="Native" names={health.native} tone="native" />
          {health.mcp.length > 0 ? (
            <ToolChips title="MCP" names={health.mcp} tone="mcp" />
          ) : (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
              No MCP tools connected. Enable the AEVION registry MCP with AGENT_RUNTIME_MCP_DEMO=1.
            </div>
          )}
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {log.length === 0 && (
          <div style={{ color: "#7c90b5", fontSize: 12, lineHeight: 1.5 }}>
            {projectId
              ? D.hintProject
              : D.hint}
          </div>
        )}
        <AiBadge />
        {log.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
              padding: "8px 11px",
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: m.error ? "#fecaca" : "#e6edf8",
              background:
                m.role === "user"
                  ? "linear-gradient(135deg, #4f46e5, #0891b2)"
                  : m.error
                    ? "rgba(127,29,29,0.35)"
                    : "rgba(255,255,255,0.05)",
              border: m.role === "user" ? "none" : "1px solid #26334f",
            }}
          >
            {m.text}
            {m.activity && m.activity.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                {m.activity.map((a, j) => (
                  <span
                    key={j}
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 999,
                      color: a.ok ? "#bbf7d0" : "#fecaca",
                      background: a.ok ? "rgba(22,101,52,0.35)" : "rgba(127,29,29,0.35)",
                      border: `1px solid ${a.ok ? "#166534" : "#7f1d1d"}`,
                    }}
                  >
                    {a.ok ? "✓" : "✕"} {a.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: "#8aa0c6", fontSize: 12 }}>{D.working}</div>}
      </div>

      {/* input */}
      <div style={{ padding: 10, borderTop: "1px solid #24314d", background: DARK }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={D.placeholder}
            aria-label={D.input}
            style={{
              flex: 1,
              resize: "none",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#0b1424",
              color: "#e6edf8",
              fontSize: 12.5,
              padding: "8px 10px",
              outline: "none",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={() => void send()}
            disabled={busy || !canSend(input)}
            aria-label={D.send}
            style={{
              padding: "9px 14px",
              borderRadius: 8,
              border: "none",
              background: busy || !canSend(input) ? "#334155" : "linear-gradient(135deg, #6366f1, #06b6d4)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              cursor: busy || !canSend(input) ? "default" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {D.send}
          </button>
        </div>
      </div>
    </div>
  );
}
