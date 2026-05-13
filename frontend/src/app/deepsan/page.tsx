"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import MvpConceptBoard from "@/components/MvpConceptBoard";

type Priority = "high" | "medium" | "low";
type TaskState = "next-action" | "waiting" | "done";

type ParsedTask = {
  title: string;
  owner: string;
  deadline: string;
  priority: Priority;
  state: TaskState;
};

const SAMPLE_INBOX = `From: anna@school47.kz
Subject: Re: смета капремонт
Привет! Нужны коммерческие предложения на кровельные материалы
до пятницы. Также Серик просил подготовить дефектный акт по фасаду
к среде. И не забудь — Министерство ждёт форму №2 до 15-го числа.

---
Slack #build-team:
@dosym: статус по школе №47? замдиректора напоминает про КС-3
@maria: вендор прислал счёт на 4.2млн — нужен второй квот срочно

---
Notes (self):
- созвон с подрядчиком завтра 11:00
- проверить индекс пересчёта Q2/2025 для расценки 06-01-001-01`;

const PRIORITY_BADGE: Record<Priority, string> = {
  high: "bg-rose-500/20 text-rose-200 border-rose-400/40",
  medium: "bg-amber-500/20 text-amber-200 border-amber-400/40",
  low: "bg-slate-500/20 text-slate-200 border-slate-400/40",
};

const STATE_PILL: Record<TaskState, string> = {
  "next-action": "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  waiting: "bg-amber-500/15 text-amber-200 border-amber-400/30",
  done: "bg-slate-500/15 text-slate-300 border-slate-400/30 line-through",
};

const STATE_LABEL: Record<TaskState, string> = {
  "next-action": "→ next-action",
  waiting: "⏳ waiting",
  done: "✓ done",
};

const NEXT_STATE: Record<TaskState, TaskState> = {
  "next-action": "waiting",
  waiting: "done",
  done: "next-action",
};

function coercePriority(v: unknown): Priority {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "high" || s === "h" || s === "urgent" || s === "critical") return "high";
  if (s === "low" || s === "l") return "low";
  return "medium";
}

function parseTasksFromReply(reply: string): ParsedTask[] {
  if (!reply) return [];
  let body = reply.trim();
  // Strip ```json ... ``` fences
  body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  const first = body.indexOf("[");
  const last = body.lastIndexOf("]");
  if (first === -1 || last === -1 || last <= first) return [];
  const slice = body.slice(first, last + 1);
  let raw: unknown;
  try {
    raw = JSON.parse(slice);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: ParsedTask[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = String(obj.title ?? "").trim();
    if (!title) continue;
    out.push({
      title,
      owner: String(obj.owner ?? "").trim() || "—",
      deadline: String(obj.deadline ?? "").trim() || "—",
      priority: coercePriority(obj.priority),
      state: "next-action",
    });
    if (out.length >= 6) break;
  }
  return out;
}

export default function DeepSanPage() {
  const [inbox, setInbox] = useState(SAMPLE_INBOX);
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Focus session
  const FOCUS_SECONDS = 25 * 60;
  const [secLeft, setSecLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toast for agent delegation mock
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSecLeft((s) => {
          if (s <= 1) {
            setRunning(false);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  async function extract() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/qcoreai/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "Extract actionable tasks. Reply ONLY in JSON array shape: [{title,owner,deadline,priority:'high'|'medium'|'low'}]. No commentary. Max 6 tasks.",
            },
            { role: "user", content: inbox },
          ],
          temperature: 0.3,
        }),
      });
      const data = (await res.json()) as { reply?: string; mode?: string };
      const parsed = parseTasksFromReply(data.reply || "");
      if (!parsed.length) {
        setErr("AI вернул пустой/невалидный JSON. Попробуйте ещё раз.");
      } else {
        setTasks(parsed);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setBusy(false);
    }
  }

  function cycleState(idx: number) {
    setTasks((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, state: NEXT_STATE[t.state] } : t))
    );
  }

  function startFocus() {
    if (secLeft === 0) setSecLeft(FOCUS_SECONDS);
    setRunning(true);
  }
  function pauseFocus() {
    setRunning(false);
  }
  function resetFocus() {
    setRunning(false);
    setSecLeft(FOCUS_SECONDS);
  }

  const mm = String(Math.floor(secLeft / 60)).padStart(2, "0");
  const ss = String(secLeft % 60).padStart(2, "0");
  const pct = Math.round(((FOCUS_SECONDS - secLeft) / FOCUS_SECONDS) * 100);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AEVION DeepSan",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    description:
      "Anti-chaos productivity. Tasks-as-states, AI inbox parser, focus sessions, QCoreAI agent bridge.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950 text-slate-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-rose-400/15 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm">
          <Link
            href="/"
            className="text-rose-200 hover:text-rose-100 transition"
          >
            ← AEVION · DeepSan · MVP
          </Link>
          <nav className="flex gap-3 text-xs text-rose-200/70">
            <Link href="/qcoreai" className="hover:text-rose-100">QCoreAI</Link>
            <Link href="/multichat-engine" className="hover:text-rose-100">Multichat</Link>
            <Link href="/qpersona" className="hover:text-rose-100">QPersona</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-rose-300/80">
          Productivity · Focus · Anti-chaos
        </div>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
          Order <span className="text-rose-300">from the inbox storm.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-slate-300">
          Антихаос-приложение: задачи как состояния, не списки.
          AI вытягивает next-action из переписок, focus-сессии режут task-switch,
          а исполнение делегируется QCoreAI-агентам.
        </p>
      </section>

      {/* AI Inbox Parser */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <div className="rounded-2xl border border-rose-400/20 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-rose-100">
              🧹 AI Inbox Parser
            </h2>
            <span className="text-xs text-rose-200/60">
              POST /api/qcoreai/chat · JSON-only mode
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Вставьте дамп почты / Slack / заметок. AI извлечёт до 6 задач со
            владельцем, дедлайном и приоритетом.
          </p>

          <textarea
            value={inbox}
            onChange={(e) => setInbox(e.target.value)}
            rows={10}
            className="mt-3 w-full rounded-xl border border-rose-400/20 bg-slate-950/60 p-3 text-sm font-mono text-slate-200 outline-none focus:border-rose-400/50"
            spellCheck={false}
          />

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={extract}
              disabled={busy || !inbox.trim()}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Извлекаю…" : "Извлечь задачи"}
            </button>
            <button
              onClick={() => {
                setInbox(SAMPLE_INBOX);
                setTasks([]);
                setErr(null);
              }}
              className="rounded-xl border border-rose-400/30 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10 transition"
            >
              Сбросить пример
            </button>
            {err && <span className="text-xs text-rose-300">{err}</span>}
          </div>

          {tasks.length > 0 && (
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {tasks.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-rose-400/15 bg-slate-950/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium text-slate-100">
                      {t.title}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${PRIORITY_BADGE[t.priority]}`}
                    >
                      {t.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>👤 {t.owner}</span>
                    <span>📅 {t.deadline}</span>
                  </div>
                  <button
                    onClick={() => cycleState(i)}
                    className={`mt-3 rounded-full border px-3 py-1 text-[11px] font-medium transition ${STATE_PILL[t.state]}`}
                    title="Click to cycle: next-action → waiting → done"
                  >
                    {STATE_LABEL[t.state]}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Focus Session + Agent Bridge */}
      <section className="mx-auto max-w-6xl px-4 pb-12 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Focus Timer */}
        <div className="rounded-2xl border border-rose-400/20 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-rose-100">
            🎯 Focus Session
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            25-минутный pomodoro. Анти-task-switch counter мониторит прерывания.
          </p>

          <div className="mt-5 flex items-center justify-between">
            <div className="font-mono text-5xl text-rose-100 tabular-nums">
              {mm}:{ss}
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-400">task-switch</div>
              <div className="text-2xl font-bold text-emerald-300">0</div>
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-400 to-amber-300 transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="mt-4 flex gap-2">
            {!running ? (
              <button
                onClick={startFocus}
                className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 transition"
              >
                ▶ Start
              </button>
            ) : (
              <button
                onClick={pauseFocus}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 transition"
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={resetFocus}
              className="rounded-xl border border-rose-400/30 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10 transition"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        {/* Agent Bridge */}
        <div className="rounded-2xl border border-rose-400/20 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold text-rose-100">
            🤖 Bridge → QCoreAI Agents
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Задачи — это не строки, а исполняемые сценарии. Делегируйте
            рутину агенту.
          </p>

          <div className="mt-4 rounded-xl border border-rose-400/15 bg-slate-950/50 p-4">
            <div className="text-sm font-medium text-slate-100">
              Delegate: Find vendors and email top 3
            </div>
            <div className="mt-1 text-xs text-slate-400">
              Поиск поставщиков кровельных материалов → шорт-лист 3 →
              автодрафт письма с RFQ.
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-rose-400/30 px-2 py-0.5 text-rose-200">
                agent · vendor-finder
              </span>
              <span className="rounded-full border border-amber-400/30 px-2 py-0.5 text-amber-200">
                async · ~4 min
              </span>
            </div>
            <button
              onClick={() => setToast("Routing to QCoreAI agent…")}
              className="mt-3 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400 transition"
            >
              Run agent
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-400">
            Реальный routing — в{" "}
            <Link href="/qcoreai" className="text-rose-300 hover:underline">
              /qcoreai
            </Link>
            . Здесь — demo-stub.
          </div>
        </div>
      </section>

      <MvpConceptBoard
        moduleId="deepsan"
        noun="runs"
        titleField="facility"
        summaryField="method"
        accent="rose"
        sectionTitle="Community sanitation runs"
        sectionHint="Зарегистрированные операции глубокой санитации — методы, объекты, результаты."
        fields={[
          { key: "facility", label: "Объект", required: true, placeholder: "Склад BC-3, секция #4" },
          { key: "method", label: "Метод", required: true, placeholder: "O₃ + UV-C 30 мин · 250 м³" },
          { key: "notes", label: "Заметки", type: "textarea", required: false, placeholder: "Что сработало, что нет." },
        ]}
      />

      {/* Cross-links footer */}
      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl border border-rose-400/15 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-rose-100">
            Related AEVION modules
          </h3>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <Link
              href="/qcoreai"
              className="rounded-xl border border-rose-400/20 bg-slate-950/50 p-3 hover:border-rose-400/50 transition"
            >
              <div className="font-medium text-rose-200">QCoreAI →</div>
              <div className="mt-1 text-xs text-slate-400">
                Agent engine — куда DeepSan делегирует исполнение.
              </div>
            </Link>
            <Link
              href="/multichat-engine"
              className="rounded-xl border border-rose-400/20 bg-slate-950/50 p-3 hover:border-rose-400/50 transition"
            >
              <div className="font-medium text-rose-200">Multichat Engine →</div>
              <div className="mt-1 text-xs text-slate-400">
                Inbox-источник: action items прямо из переписок.
              </div>
            </Link>
            <Link
              href="/qpersona"
              className="rounded-xl border border-rose-400/20 bg-slate-950/50 p-3 hover:border-rose-400/50 transition"
            >
              <div className="font-medium text-rose-200">QPersona →</div>
              <div className="mt-1 text-xs text-slate-400">
                AI-двойник для исполнения задач вашим стилем.
              </div>
            </Link>
          </div>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-xl border border-rose-400/30 bg-slate-900/90 px-4 py-2 text-sm text-rose-100 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}
    </main>
  );
}
