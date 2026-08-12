"use client";

// Страница модуля «Мультичат» — рабочая консоль плюс витрина вокруг неё.
//
// Из файла удалён неиспользуемый рабочий стол агентов (AgentPanel и всё, что
// обслуживало только его: словарь переводов панели, роли, пресеты, @-передача
// между агентами, ссылка-воркспейс, демо-набор, выгрузка на агента). Он был
// написан, но НИ РАЗУ не отрисован: `git log -S"<AgentPanel"` по истории файла
// пуст, а страница с самого начала показывает CouncilConsole. Продукт пошёл
// другой дорогой — консилиум с картой разногласий (PR 939 и далее).
//
// Почему удалено, а не оставлено «на всякий случай»: 900 строк выглядели
// рабочей функцией и читались как рабочая функция. Интерфейс внутри них
// предлагал «@code, @finance, @legal», подсказывал теги автодополнением и
// рисовал пометки «↪ via @x» — то есть при чтении файла это неотличимо от
// живой возможности, которой у пользователя нет. Восстановить при
// необходимости: `git show 44257f43d:frontend/src/app/multichat-engine/MultichatEngineClient.tsx`.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import ModulePricingChip from "@/components/ModulePricingChip";
import { apiUrl, getClientApiBase } from "@/lib/apiBase";
import { isAuthenticated } from "@/lib/auth";
import { CouncilConsole } from "./CouncilConsole";
import { T } from "./theme";

/* ─────────────────────────────────────────────────────────────────
 * Phase 3 additions wired into the landing:
 *   A) ProviderHealthStrip — live ping of /api/multichat/provider-status,
 *      auto-refresh every 30s, badges per provider with latency + status dot.
 *   B) MissionPresetGrid — server-defined preset catalogue from
 *      /api/multichat/presets, each card "Launch" button POSTs to
 *      /api/multichat/presets/:id/launch and routes the user to
 *      /qcoreai/multi pre-filled.
 * Both consume apiUrl() so they work in dev (Vercel proxy) and prod.
 * ────────────────────────────────────────────────────────────── */

type LiveProviderStatus = {
  id: string;
  name: string;
  configured: boolean;
  reachable: boolean;
  latencyMs: number | null;
  defaultModel: string | null;
};

function ProviderHealthStrip() {
  const [providers, setProviders] = useState<LiveProviderStatus[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gated, setGated] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(apiUrl("/api/multichat/provider-status"), {
        credentials: "include",
      });
      // 402 — это не сбой, а ответ платной стены, и он не изменится от того,
      // что мы спросим ещё сорок раз. Гость сюда вообще не заходит (см.
      // эффект ниже), а вот у авторизованного на free-тарифе опрос иначе
      // бьёт в стену каждые 30 секунд до конца жизни вкладки.
      if (r.status === 402) {
        setGated(true);
        return;
      }
      if (!r.ok) {
        setErr(`status ${r.status}`);
        return;
      }
      const data = (await r.json()) as {
        providers?: LiveProviderStatus[];
        cachedAt?: string;
      };
      setProviders(Array.isArray(data.providers) ? data.providers : []);
      setUpdatedAt(data.cachedAt ?? new Date().toISOString());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "fetch failed");
    }
  }, []);

  useEffect(() => {
    // Ручка за платной стеной: гостю она отвечает 402, а глобальный
    // перехватчик превращает каждый 402 в модалку тарифа. При опросе раз в
    // 30 секунд это значит, что модалка возвращается поверх бесплатного
    // демо сразу после того, как её закрыли. Поэтому без входа в сеть не
    // ходим вообще и показываем честное «после входа».
    // isAuthenticated() читает localStorage — только внутри эффекта, иначе
    // разъезжается гидрация.
    if (!isAuthenticated()) {
      setGated(true);
      return;
    }
    // Стена уже ответила — переспрашивать нечего: эффект перезапустится по
    // смене gated, снимет интервал и выйдет.
    if (gated) return;
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load, gated]);

  return (
    <section
      style={{
        marginTop: 16,
        marginBottom: 16,
        borderRadius: 14,
        border: `1px solid ${T.violetEdge25}`,
        background: `linear-gradient(180deg, ${T.indigoVeil96}, ${T.inkVeil96})`,
        padding: "14px 16px",
        color: T.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.accent,
          }}
        >
          ◉ Ключи поставщиков
        </span>
        <span style={{ flex: 1 }} />
        {!gated && (
        <button
          type="button"
          onClick={load}
          style={{
            padding: "3px 9px",
            borderRadius: 7,
            border: `1px solid ${T.tealEdge40}`,
            background: T.greenFill18,
            color: T.accent,
            cursor: "pointer",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.05em",
          }}
          aria-label="Refresh provider health"
        >
          ↻ Refresh
        </button>
        )}
        <span style={{ fontSize: 10, color: T.textFaded }}>
          {gated ? "· после входа" : updatedAt ? `· ${new Date(updatedAt).toLocaleTimeString()}` : "· loading…"}
        </span>
      </div>

      {gated ? (
        <div style={{ fontSize: 12, color: T.textMute }}>
          Живой пинг поставщиков — на платном тарифе. Разбор разногласий ниже работает без входа.
        </div>
      ) : err ? (
        <div style={{ fontSize: 12, color: T.bad }}>Health check unavailable: {err}</div>
      ) : !providers ? (
        <div style={{ fontSize: 12, color: T.textMute }}>Pinging providers…</div>
      ) : providers.length === 0 ? (
        <div style={{ fontSize: 12, color: T.textMute }}>No providers reported.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
          }}
        >
          {/* Оговорка обязательна и стоит рядом с самими значками: без неё
              список ключей читается как список работающих поставщиков —
              ровно то заблуждение, которое здесь и было. */}
          {providers.map((p) => {
            // Показываем ровно то, что известно: задан ли ключ.
            //
            // Здесь стояли «online / down», зелёный огонёк и задержка вида
            // «3ms ⚠». Ни одно из этих утверждений не измерялось: данные
            // приходят из /api/qcoreai/providers, а тот СИНХРОННО читает
            // переменные окружения и перечисляет провайдеров с заданным
            // ключом — обращения к Anthropic, OpenAI и прочим там нет ни
            // одной строкой. «Задержка» была временем ответа нашего же
            // localhost, поданным как задержка провайдера.
            //
            // То есть при лежащем OpenAI страница писала «online». Наличие
            // ключа — полезный факт, и он остаётся; выдуманная доступность
            // ушла.
            const dotColor = p.configured ? T.goodBright : T.textFaded;
            const stateLabel = p.configured ? "ключ настроен" : "ключа нет";
            return (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "9px 11px",
                  borderRadius: 10,
                  border: `1px solid ${p.configured ? (p.reachable ? T.greenEdge35 : T.redEdge35) : T.indigoEdge35}`,
                  background: T.inkVeil60,
                }}
                title={
                  p.configured
                    ? `${p.name} · ${stateLabel}${p.defaultModel ? ` · модель по умолчанию ${p.defaultModel}` : ""}`
                    : `${p.name} not configured (missing API key)`
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: dotColor,
                      boxShadow:
                        p.configured && p.reachable
                          ? `0 0 8px ${dotColor}`
                          : "none",
                    }}
                    aria-hidden
                  />
                  <span style={{ fontSize: 12, fontWeight: 800, color: T.textSoft }}>
                    {p.name}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    fontSize: 10,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    color: T.textMute,
                  }}
                >
                  <span
                    style={{
                      color: p.configured ? T.good : T.textFaded,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {stateLabel}
                  </span>
                  {p.defaultModel ? <span>· {p.defaultModel}</span> : null}
                </div>
              </div>
            );
          })}
          <p
            style={{
              gridColumn: "1 / -1",
              margin: "2px 0 0",
              fontSize: 11,
              lineHeight: 1.5,
              color: T.textFaded,
            }}
          >
            Здесь видно, у каких поставщиков задан ключ. Доступность самих
            поставщиков не проверяется — это стоило бы платного запроса к каждому
            на каждую загрузку страницы.
          </p>
        </div>
      )}
    </section>
  );
}

type MissionPreset = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  systemPrompt: string;
  recommendedAgents: Array<{ role: string; provider?: string; temperature?: number }>;
  defaultProvider: string;
};

function MissionPresetGrid() {
  const [presets, setPresets] = useState<MissionPreset[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [gated, setGated] = useState(false);

  useEffect(() => {
    // Как и provider-status: без входа это гарантированный 402, то есть
    // модалка тарифа поверх бесплатного демо. Не спрашиваем.
    if (!isAuthenticated()) {
      setGated(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/multichat/presets"), {
          credentials: "include",
        });
        // «Mission presets unavailable: status 402» — не ошибка, а платный
        // тариф. Показываем это как тариф, а не как поломку.
        if (r.status === 402) {
          if (alive) setGated(true);
          return;
        }
        if (!r.ok) {
          if (alive) setErr(`status ${r.status}`);
          return;
        }
        const data = (await r.json()) as { presets?: MissionPreset[] };
        if (alive) setPresets(Array.isArray(data.presets) ? data.presets : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || "fetch failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const launch = useCallback(async (preset: MissionPreset) => {
    setLaunching(preset.id);
    try {
      const r = await fetch(apiUrl(`/api/multichat/presets/${preset.id}/launch`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `${preset.emoji} ${preset.name}` }),
      });
      if (!r.ok) {
        setLaunching(null);
        const msg = r.status === 401 ? "Sign in to launch a mission." : `Launch failed (${r.status}).`;
        // Inline error: surface via an alert + visual via err state
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }
      const data = (await r.json()) as {
        conversation?: { id?: string };
      };
      const convId = data?.conversation?.id;
      if (convId && typeof window !== "undefined") {
        // Route to the multi-agent runner with the new conversation preselected.
        // The /qcoreai/multi page reads ?conv= + ?preset= to pre-wire roles.
        window.location.href = `/qcoreai/multi?conv=${encodeURIComponent(convId)}&preset=${encodeURIComponent(preset.id)}`;
      } else {
        setLaunching(null);
      }
    } catch (e: any) {
      setLaunching(null);
      if (typeof window !== "undefined") window.alert(e?.message || "Network error");
    }
  }, []);

  if (err) {
    return (
      <section
        style={{
          marginTop: 16,
          marginBottom: 16,
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${T.redEdge35}`,
          background: T.redFill18,
          color: T.bad,
          fontSize: 12,
        }}
      >
        Mission presets unavailable: {err}
      </section>
    );
  }

  // Гостю запрос не уходит вовсе, поэтому presets навсегда остался бы null,
  // а вечное «Loading missions…» — это ложь про состояние. Говорим как есть.
  if (gated || !presets) {
    return (
      <section
        style={{
          marginTop: 16,
          marginBottom: 16,
          padding: "12px 14px",
          borderRadius: 14,
          border: `1px solid ${T.violetEdge25}`,
          background: T.indigoVeil70,
          color: T.textMute,
          fontSize: 12,
        }}
      >
        {gated ? "Готовые сценарии панелей — на платном тарифе. Пример разбора ниже открыт без входа." : "Loading missions…"}
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: 16,
        marginBottom: 16,
        borderRadius: 14,
        border: `1px solid ${T.violetEdge35}`,
        background:
          `linear-gradient(180deg, ${T.indigoVeil96}, ${T.indigoEdge45})`,
        padding: "16px 18px",
        color: T.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: T.brand,
          }}
        >
          ✦ Mission presets
        </span>
        <span style={{ fontSize: 11, color: T.textMute }}>
          One click → preconfigured agent bundle on a curated system prompt.
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {presets.map((preset) => {
          const isOpen = previewId === preset.id;
          return (
            <div
              key={preset.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${T.violetEdge30}`,
                background: T.inkVeil65,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{preset.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.textSoft }}>
                    {preset.name}
                  </div>
                  <div style={{ fontSize: 10, color: T.textMute, marginTop: 2 }}>
                    {preset.recommendedAgents.length} agent
                    {preset.recommendedAgents.length === 1 ? "" : "s"} · default {preset.defaultProvider}
                  </div>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: 12, color: T.textDim, lineHeight: 1.5 }}>
                {preset.description}
              </p>

              {isOpen ? (
                <pre
                  style={{
                    margin: 0,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.tealEdge25}`,
                    background: T.indigoVeil85,
                    color: T.textDim,
                    fontSize: 11,
                    lineHeight: 1.45,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 180,
                    overflowY: "auto",
                  }}
                >
                  {preset.systemPrompt}
                </pre>
              ) : null}

              <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => launch(preset)}
                  disabled={launching !== null}
                  style={{
                    flex: 1,
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      launching === preset.id
                        ? T.violetEdge40
                        : `linear-gradient(135deg, ${T.brandDeep}, ${T.indigo})`,
                    color: T.onAccent,
                    cursor: launching !== null ? "wait" : "pointer",
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: "0.03em",
                  }}
                >
                  {launching === preset.id ? "Launching…" : "Launch →"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewId((cur) => (cur === preset.id ? null : preset.id))
                  }
                  aria-expanded={isOpen}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 8,
                    border: `1px solid ${T.violetEdge25}`,
                    background: T.indigoVeil60,
                    color: T.textMute,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                  title={isOpen ? "Hide system prompt" : "Show system prompt"}
                >
                  {isOpen ? "▲ Prompt" : "▼ Prompt"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function MultichatEnginePage() {
  const origin = getClientApiBase();

  return (
    <main>
      <ProductPageShell maxWidth={860}>
        <Wave1Nav />

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <ModulePricingChip moduleId="multichat-engine" theme="dark" />
        </div>

        {/* Рабочая консоль стоит первой: модуль должен открываться промтом
            «опиши — сделаю», а не описанием возможностей. */}
        <CouncilConsole />

        <div
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 20,
            background: `linear-gradient(135deg, ${T.surface}, ${T.brandInk}, ${T.brandInkSoft})`,
            padding: "28px 28px 24px",
            color: T.onAccent,
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>
            AEVION Multichat Engine
          </h1>
          <p style={{ margin: "8px 0 0", color: T.neutralVeil82, fontSize: 14, lineHeight: 1.55 }}>
            One backend, five LLM providers, two modes. Pick a single-model chat for quick answers,
            or a multi-agent pipeline when you need a second (and third) pair of eyes on the answer.
          </p>
        </div>

        <ProviderHealthStrip />
        <MissionPresetGrid />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {/* Single chat card */}
          <Link
            href="/qcoreai"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: `1px solid ${T.indigoFill12}`,
              borderRadius: 14,
              padding: 20,
              background: T.cardLight,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: `0 1px 4px ${T.indigoFill04}`,
              transition: "transform 0.12s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${T.accentDeep}, ${T.cyan})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.onAccent,
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: "0.03em",
                }}
              >
                S
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.inkOnCard }}>Single chat</div>
                <div style={{ fontSize: 11, color: T.textFaded }}>One provider · one model · fastest path</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.inkOnCardMute, lineHeight: 1.55 }}>
              Classic chat experience. Pick Claude, GPT, Gemini, DeepSeek or Grok, ask a question, get an answer.
              Best for quick lookups and informal conversation.
            </p>
            <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700, color: T.accentDeeper }}>
              Open single chat →
            </span>
          </Link>

          {/* Multi-agent card */}
          <Link
            href="/qcoreai/multi"
            style={{
              textDecoration: "none",
              color: "inherit",
              border: `1px solid ${T.violetEdge35}`,
              borderRadius: 14,
              padding: 20,
              background: `linear-gradient(180deg, ${T.onAccent} 0%, ${T.violetFill04} 100%)`,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              boxShadow: `0 1px 4px ${T.violetFill08}`,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 999,
                background: T.violetFill12,
                color: T.brandDeeper,
                border: `1px solid ${T.violetEdge30}`,
              }}
            >
              New
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${T.brandDeep}, ${T.indigo})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: T.onAccent,
                  fontWeight: 900,
                  fontSize: 13,
                  letterSpacing: "0.03em",
                }}
              >
                MA
              </span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: T.inkOnCard }}>Multi-agent</div>
                <div style={{ fontSize: 11, color: T.textFaded }}>Analyst → Writer → Critic · inspectable</div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: T.inkOnCardMute, lineHeight: 1.55 }}>
              Three specialized agents coordinate on every answer. Pick <b>Sequential</b> for a classic reflection loop,
              <b> Parallel</b> for two writers on different models merged by a Judge, or <b>Debate</b> where a Pro and a Con
              advocate argue and a Moderator synthesizes a balanced recommendation.
            </p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
              {[
                { t: "3 strategies", c: T.brandDeep },
                { t: "Live streaming", c: T.skyDeeper },
                { t: "Live cost + tokens", c: T.goodDeep },
                { t: "Mixed models per role", c: T.indigo },
                { t: "Saveable presets", c: T.accentDeep },
                { t: "Edit & resend", c: T.cyanDeep },
                { t: "Webhook on done", c: T.skyDeep },
                { t: "Public share + OG preview", c: T.brandAlt },
                { t: "Export JSON + Markdown", c: T.warnDeep },
                { t: "↩ Thread continuation", c: T.brandDeeper },
                { t: "📋 Templates", c: T.indigoBright },
                { t: "⚡ Batch runs", c: T.indigoDeep },
              ].map((b) => (
                <span
                  key={b.t}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 999,
                    background: `${b.c}14`,
                    color: b.c,
                    border: `1px solid ${b.c}33`,
                  }}
                >
                  {b.t}
                </span>
              ))}
            </div>
            <span style={{ marginTop: "auto", fontSize: 12, fontWeight: 700, color: T.brandDeeper }}>
              Open multi-agent →
            </span>
          </Link>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: T.textFaded }}>
          {[
            { href: "/qcoreai/analytics", label: "📊 Analytics" },
            { href: "/qcoreai/eval",      label: "🧪 Eval harness" },
            { href: "/qcoreai/prompts",   label: "📝 Prompts library" },
            { href: "/qcoreai/batch",     label: "⚡ Batch runs" },
            { href: "/qcoreai/schedule",  label: "🕐 Scheduled batches" },
            { href: "/qcoreai/notebook",  label: "📓 Notebook" },
            { href: "/qcoreai/providers", label: "◈ AI Providers" },
            { href: "/qcoreai/docs",       label: "📖 API Docs" },
            { href: "/qcoreai/playground", label: "🎮 Playground" },
            { href: "/qcoreai/top",        label: "⭐ Top Rated" },
            { href: "/qcoreai/pipeline",   label: "⚙️ Pipeline Builder" },
            { href: "/qcoreai/optimize",   label: "✨ Optimizer" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              style={{
                border: `1px solid ${T.brandGlow}`,
                background: T.violetFill06,
                borderRadius: 8,
                padding: "6px 10px",
                textDecoration: "none",
                color: T.brandDeeper,
                fontWeight: 700,
              }}
            >
              {label}
            </Link>
          ))}
          <div style={{ width: 1, background: T.divider, margin: "0 2px" }} />
          <a
            href={`${origin}/api/qcoreai/health`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: `1px solid ${T.textDim}`,
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: T.inkOnCardSoft,
              fontWeight: 650,
            }}
          >
            Backend health
          </a>
          <a
            href={`${origin}/api/qcoreai/providers`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: `1px solid ${T.textDim}`,
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: T.inkOnCardSoft,
              fontWeight: 650,
            }}
          >
            Configured providers
          </a>
          <a
            href={`${origin}/api/qcoreai/agents`}
            target="_blank"
            rel="noreferrer"
            style={{
              border: `1px solid ${T.textDim}`,
              borderRadius: 8,
              padding: "6px 10px",
              textDecoration: "none",
              color: T.inkOnCardSoft,
              fontWeight: 650,
            }}
          >
            Role defaults
          </a>
        </div>
      </ProductPageShell>
    </main>
  );
}
