"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { apiUrl, getBackendOrigin } from "@/lib/apiBase";
import { launchedModules } from "@/data/pitchModel";
import { useI18n, type Lang } from "@/lib/i18n";

/* ─────────────────────────────────────────────────────────────────
 * Module-local i18n — lives next to the module instead of bloating
 * the global dictionary in src/lib/i18n.tsx.
 * ────────────────────────────────────────────────────────────── */

const MC_STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    "mc.badge": "Multichat Engine · Live",
    "mc.title.a": "Parallel agents,",
    "mc.title.b": "one identity, one window",
    "mc.subtitle.fallback":
      "Parallel agent sessions over QCoreAI — code, finance, IP, content in one window.",
    "mc.stat.backend.label": "Backend",
    "mc.stat.backend.hint": "Single endpoint live",
    "mc.stat.stage.label": "Stage",
    "mc.stat.stage.value": "Live",
    "mc.stat.stage.hint": "Parallel agents shipped",
    "mc.stat.providers.label": "Providers",
    "mc.stat.providers.hint": "via QCoreAI router",
    "mc.stat.b2b.label": "B2B angle",
    "mc.stat.b2b.value": "White-label",
    "mc.stat.b2b.hint": "AEVION inside SaaS line",
    "mc.cta.try": "Try parallel agents ↓",
    "mc.cta.single": "Single chat (QCoreAI) →",
    "mc.cta.health": "QCoreAI health",
    "mc.ctx.label": "Personalised",
    "mc.ctx.work": "{n} IP work",
    "mc.ctx.works": "{n} IP works",
    "mc.ctx.toggle": "Inject into agents",
    "mc.ctx.toggle.title":
      "Inject your real AEVION account state into agent system prompts",
    "mc.vision.eyebrow": "The vision",
    "mc.vision.title": "From a chat box to an agent operating system",
    "mc.vision.body.fallback":
      "Users open four tabs to work with four different AI assistants. Multichat Engine collapses that into a single window — and then layers parallel agents on top, each with its own role, memory and tool scope.",
    "mc.vision.b1":
      "One window, many agents — no more juggling 4 browser tabs for 4 different AIs.",
    "mc.vision.b2":
      "Each session inherits AEVION context: your IP portfolio (QRight), your wallet (Bank), your tier (Trust Score), your awards.",
    "mc.vision.b3":
      "Agents can cross-call each other through QCoreAI routing — Code agent hands off to Finance agent without losing context.",
    "mc.vision.b4":
      "Centralised model spend across the platform: predictable per-token economics, single biggest OPEX win in the company.",
    "mc.preset.eyebrow": "Quick start",
    "mc.preset.title": "One click → curated agent bundle",
    "mc.preset.note":
      "Replaces current agents. Settings persist in localStorage.",
    "mc.preset.investor.name": "Investor pack",
    "mc.preset.investor.desc":
      "Story + financials + IP defense in one window",
    "mc.preset.founder.name": "Founder ops",
    "mc.preset.founder.desc": "Code, money, regulation — parallel decisions",
    "mc.preset.legal.name": "Legal review",
    "mc.preset.legal.desc": "Contracts, compliance, multilingual clauses",
    "mc.preset.global.name": "Multilingual support",
    "mc.preset.global.desc": "Customer ops in any language",
    "mc.preset.fullstack.name": "Full stack",
    "mc.preset.fullstack.desc": "Every role at once — only for power users",
    "mc.live.eyebrow": "Live · parallel agents",
    "mc.live.count.one": "{n}/{max} active session",
    "mc.live.count.many": "{n}/{max} active sessions",
    "mc.live.spawn": "+ Spawn agent",
    "mc.live.clearAll": "Clear all",
    "mc.live.confirm.wipe":
      "Wipe all agents and conversations? This cannot be undone.",
    "mc.live.confirm.preset":
      "Replace {cur} agent(s) (some have conversation history) with \"{name}\" ({n} agents)?",
    "mc.killer.eyebrow": "Killer feature",
    "mc.network.eyebrow": "Network role",
    "mc.footer.body":
      "Multichat Engine is the social and agent glue for the rest of AEVION — Planet voting, Bank Advisor, Awards judging, customer service.",
    "mc.footer.pitch": "Investor pitch →",
    "mc.footer.demo": "Live demo →",
    "mc.footer.qcoreai": "Open QCoreAI →",
    "mc.panel.prompt": "✎ Prompt",
    "mc.panel.prompt.custom": "✎ Prompt · custom",
    "mc.panel.prompt.title": "Edit this agent's system prompt",
    "mc.panel.export.md": "↓ MD",
    "mc.panel.export.md.title": "Export conversation as Markdown",
    "mc.panel.export.json": "↓ JSON",
    "mc.panel.export.json.title": "Export conversation as JSON",
    "mc.panel.msg.one": "{n} msg",
    "mc.panel.msg.many": "{n} msgs",
    "mc.panel.editor.label": "System prompt for this agent",
    "mc.panel.editor.save": "Save",
    "mc.panel.editor.reset": "Reset to default",
    "mc.panel.editor.cancel": "Cancel",
    "mc.panel.empty.title": "{role} agent ready",
    "mc.panel.empty.desc":
      "System prompt is preset. Send a message to start.",
    "mc.panel.placeholder":
      "Message {role}…  (try @code, @finance, @legal to relay)",
    "mc.panel.send": "Send",
    "mc.panel.relay": "Relay:",
    "mc.panel.role.aria": "Agent role",
    "mc.panel.provider.aria": "Provider",
    "mc.panel.model.aria": "Model",
    "mc.panel.close.aria": "Close agent",
    "mc.panel.close.title": "Close agent",
    "mc.panel.typing.aria": "Agent is typing",
    "mc.handoff.noTarget":
      "No active @{tag} agent in this window. Click \"+ Spawn agent\" and pick role \"{role}\" to enable handoff.",
  },
  ru: {
    "mc.badge": "Multichat Engine · Live",
    "mc.title.a": "Параллельные агенты,",
    "mc.title.b": "одна личность, одно окно",
    "mc.subtitle.fallback":
      "Параллельные сессии агентов поверх QCoreAI — код, финансы, IP, контент в одном окне.",
    "mc.stat.backend.label": "Бэкенд",
    "mc.stat.backend.hint": "Один эндпоинт",
    "mc.stat.stage.label": "Стадия",
    "mc.stat.stage.value": "Live",
    "mc.stat.stage.hint": "Параллельные агенты в проде",
    "mc.stat.providers.label": "Провайдеры",
    "mc.stat.providers.hint": "через QCoreAI router",
    "mc.stat.b2b.label": "B2B",
    "mc.stat.b2b.value": "White-label",
    "mc.stat.b2b.hint": "AEVION внутри SaaS продукта",
    "mc.cta.try": "К параллельным агентам ↓",
    "mc.cta.single": "Один чат (QCoreAI) →",
    "mc.cta.health": "Здоровье QCoreAI",
    "mc.ctx.label": "Персонализация",
    "mc.ctx.work": "{n} IP-объект",
    "mc.ctx.works": "{n} IP-объектов",
    "mc.ctx.toggle": "Вшить в агентов",
    "mc.ctx.toggle.title":
      "Подмешать данные вашего AEVION-аккаунта в system prompt агентов",
    "mc.vision.eyebrow": "Видение",
    "mc.vision.title": "От чат-окна к ОС агентов",
    "mc.vision.body.fallback":
      "Люди открывают четыре вкладки, чтобы пользоваться четырьмя разными AI-ассистентами. Multichat Engine схлопывает их в одно окно и накладывает параллельных агентов — у каждого своя роль, память и tool scope.",
    "mc.vision.b1":
      "Одно окно, много агентов — никаких 4 вкладок ради 4 разных AI.",
    "mc.vision.b2":
      "Каждая сессия знает контекст AEVION: ваш IP-портфель (QRight), кошелёк (Bank), Trust Score, Awards.",
    "mc.vision.b3":
      "Агенты могут вызывать друг друга через QCoreAI — Code-агент передаёт задачу Finance-агенту, не теряя контекст.",
    "mc.vision.b4":
      "Централизованные расходы на модели на платформе: предсказуемая токен-экономика, главный OPEX-выигрыш компании.",
    "mc.preset.eyebrow": "Быстрый старт",
    "mc.preset.title": "Один клик → готовый набор агентов",
    "mc.preset.note":
      "Заменит текущих агентов. Настройки сохранятся в localStorage.",
    "mc.preset.investor.name": "Инвестор-пак",
    "mc.preset.investor.desc": "Story + финансы + IP-защита в одном окне",
    "mc.preset.founder.name": "Founder ops",
    "mc.preset.founder.desc": "Код, деньги, регуляция — параллельные решения",
    "mc.preset.legal.name": "Юр. ревью",
    "mc.preset.legal.desc": "Контракты, compliance, многоязычные оговорки",
    "mc.preset.global.name": "Multilingual support",
    "mc.preset.global.desc": "Поддержка клиентов на любом языке",
    "mc.preset.fullstack.name": "Full stack",
    "mc.preset.fullstack.desc": "Все роли сразу — для опытных",
    "mc.live.eyebrow": "Live · параллельные агенты",
    "mc.live.count.one": "{n}/{max} активная сессия",
    "mc.live.count.many": "{n}/{max} активных сессий",
    "mc.live.spawn": "+ Добавить агента",
    "mc.live.clearAll": "Очистить всё",
    "mc.live.confirm.wipe":
      "Удалить всех агентов и переписки? Отменить нельзя.",
    "mc.live.confirm.preset":
      "Заменить {cur} агент(ов) (часть с историей) на \"{name}\" ({n} агента)?",
    "mc.killer.eyebrow": "Killer-фича",
    "mc.network.eyebrow": "Роль в сети",
    "mc.footer.body":
      "Multichat Engine — социальный и agent-клей всего AEVION: голосование Planet, Advisor в Bank, жюри Awards, клиентская поддержка.",
    "mc.footer.pitch": "Инвестор-питч →",
    "mc.footer.demo": "Live demo →",
    "mc.footer.qcoreai": "Открыть QCoreAI →",
    "mc.panel.prompt": "✎ Prompt",
    "mc.panel.prompt.custom": "✎ Prompt · свой",
    "mc.panel.prompt.title": "Редактировать system prompt этого агента",
    "mc.panel.export.md": "↓ MD",
    "mc.panel.export.md.title": "Скачать переписку как Markdown",
    "mc.panel.export.json": "↓ JSON",
    "mc.panel.export.json.title": "Скачать переписку как JSON",
    "mc.panel.msg.one": "{n} сообщение",
    "mc.panel.msg.many": "{n} сообщений",
    "mc.panel.editor.label": "System prompt для этого агента",
    "mc.panel.editor.save": "Сохранить",
    "mc.panel.editor.reset": "По умолчанию",
    "mc.panel.editor.cancel": "Отмена",
    "mc.panel.empty.title": "Агент {role} готов",
    "mc.panel.empty.desc":
      "System prompt задан. Отправьте сообщение, чтобы начать.",
    "mc.panel.placeholder":
      "Сообщение для {role}…  (попробуйте @code, @finance, @legal)",
    "mc.panel.send": "Отправить",
    "mc.panel.relay": "Relay:",
    "mc.panel.role.aria": "Роль агента",
    "mc.panel.provider.aria": "Провайдер",
    "mc.panel.model.aria": "Модель",
    "mc.panel.close.aria": "Закрыть агента",
    "mc.panel.close.title": "Закрыть агента",
    "mc.panel.typing.aria": "Агент печатает",
    "mc.handoff.noTarget":
      "В этом окне нет активного @{tag}-агента. Нажмите \"+ Добавить агента\" и выберите роль \"{role}\".",
  },
  kk: {
    "mc.badge": "Multichat Engine · Live",
    "mc.title.a": "Параллель агенттер,",
    "mc.title.b": "бір тұлға, бір терезе",
    "mc.subtitle.fallback":
      "QCoreAI үстіндегі параллель агент-сессиялар — код, қаржы, IP, контент бір терезеде.",
    "mc.stat.backend.label": "Бэкенд",
    "mc.stat.backend.hint": "Бірыңғай эндпоинт",
    "mc.stat.stage.label": "Стадия",
    "mc.stat.stage.value": "Live",
    "mc.stat.stage.hint": "Параллель агенттер шықты",
    "mc.stat.providers.label": "Провайдерлер",
    "mc.stat.providers.hint": "QCoreAI router арқылы",
    "mc.stat.b2b.label": "B2B",
    "mc.stat.b2b.value": "White-label",
    "mc.stat.b2b.hint": "AEVION SaaS өнімі ішінде",
    "mc.cta.try": "Параллель агенттер ↓",
    "mc.cta.single": "Жалғыз чат (QCoreAI) →",
    "mc.cta.health": "QCoreAI денсаулығы",
    "mc.ctx.label": "Жекелендірілген",
    "mc.ctx.work": "{n} IP-объект",
    "mc.ctx.works": "{n} IP-объект",
    "mc.ctx.toggle": "Агенттерге қосу",
    "mc.ctx.toggle.title":
      "Сіздің AEVION-аккаунт күйіңіз агент system prompt-қа қосылады",
    "mc.vision.eyebrow": "Идея",
    "mc.vision.title": "Чат-терезеден агент-ОС-ға дейін",
    "mc.vision.body.fallback":
      "Адамдар 4 түрлі AI үшін 4 бет ашады. Multichat Engine оларды бір терезеге біріктіреді — әр агенттің өз рөлі, жадысы және tool scope болады.",
    "mc.vision.b1": "Бір терезе, көп агент — 4 бет керек емес.",
    "mc.vision.b2":
      "Әр сессия AEVION контекстін біледі: IP-портфель (QRight), кошелёк (Bank), Trust Score, Awards.",
    "mc.vision.b3":
      "Агенттер бір-біріне QCoreAI арқылы хабар жібере алады — Code Finance-қа береді, контекст жоғалмайды.",
    "mc.vision.b4":
      "Платформадағы модель шығынын орталықтандыру — ең үлкен OPEX-ұтыс.",
    "mc.preset.eyebrow": "Жылдам бастау",
    "mc.preset.title": "Бір клик → даяр агент жинағы",
    "mc.preset.note":
      "Қазіргі агенттерді ауыстырады. Параметрлер localStorage-те сақталады.",
    "mc.preset.investor.name": "Инвестор-пак",
    "mc.preset.investor.desc": "Story + қаржы + IP-қорғаныс бір терезеде",
    "mc.preset.founder.name": "Founder ops",
    "mc.preset.founder.desc": "Код, ақша, реттеу — параллель шешімдер",
    "mc.preset.legal.name": "Заң ревью",
    "mc.preset.legal.desc": "Шарттар, compliance, көптілді тармақтар",
    "mc.preset.global.name": "Multilingual support",
    "mc.preset.global.desc": "Кез келген тілде клиент қолдау",
    "mc.preset.fullstack.name": "Full stack",
    "mc.preset.fullstack.desc": "Барлық рөл бірден — тәжірибеліге",
    "mc.live.eyebrow": "Live · параллель агенттер",
    "mc.live.count.one": "{n}/{max} белсенді сессия",
    "mc.live.count.many": "{n}/{max} белсенді сессия",
    "mc.live.spawn": "+ Агент қосу",
    "mc.live.clearAll": "Бәрін тазалау",
    "mc.live.confirm.wipe":
      "Барлық агент пен әңгімелерді өшіру керек пе? Қайтару мүмкін емес.",
    "mc.live.confirm.preset":
      "{cur} агент(ті) (бөлігінде тарих бар) \"{name}\" ({n} агент) орнына ауыстыру керек пе?",
    "mc.killer.eyebrow": "Killer-фича",
    "mc.network.eyebrow": "Желідегі рөл",
    "mc.footer.body":
      "Multichat Engine — AEVION-ның агент-желімі: Planet дауысы, Bank Advisor, Awards қазылар алқасы, клиент қолдау.",
    "mc.footer.pitch": "Инвестор питч →",
    "mc.footer.demo": "Live demo →",
    "mc.footer.qcoreai": "QCoreAI ашу →",
    "mc.panel.prompt": "✎ Prompt",
    "mc.panel.prompt.custom": "✎ Prompt · жеке",
    "mc.panel.prompt.title": "Осы агенттің system prompt-ын өзгерту",
    "mc.panel.export.md": "↓ MD",
    "mc.panel.export.md.title": "Әңгімені Markdown ретінде жүктеу",
    "mc.panel.export.json": "↓ JSON",
    "mc.panel.export.json.title": "Әңгімені JSON ретінде жүктеу",
    "mc.panel.msg.one": "{n} хабар",
    "mc.panel.msg.many": "{n} хабар",
    "mc.panel.editor.label": "Бұл агент үшін system prompt",
    "mc.panel.editor.save": "Сақтау",
    "mc.panel.editor.reset": "Әдепкіге қайтару",
    "mc.panel.editor.cancel": "Болдырмау",
    "mc.panel.empty.title": "{role} агенті дайын",
    "mc.panel.empty.desc":
      "System prompt алдын ала қойылған. Бастау үшін хабар жіберіңіз.",
    "mc.panel.placeholder":
      "{role}-ге хабар…  (@code, @finance, @legal көріңіз)",
    "mc.panel.send": "Жіберу",
    "mc.panel.relay": "Relay:",
    "mc.panel.role.aria": "Агент рөлі",
    "mc.panel.provider.aria": "Провайдер",
    "mc.panel.model.aria": "Модель",
    "mc.panel.close.aria": "Агентті жабу",
    "mc.panel.close.title": "Агентті жабу",
    "mc.panel.typing.aria": "Агент жазып жатыр",
    "mc.handoff.noTarget":
      "Бұл терезеде белсенді @{tag}-агент жоқ. handoff қосу үшін \"+ Агент қосу\" басып, \"{role}\" рөлін таңдаңыз.",
  },
};

function makeMcT(lang: Lang) {
  return (key: string, vars?: Record<string, string | number>): string => {
    let raw = MC_STRINGS[lang][key] ?? MC_STRINGS.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        raw = raw.split(`{${k}}`).join(String(v));
      }
    }
    return raw;
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Static content (was in the server page before client conversion)
 * ────────────────────────────────────────────────────────────── */

const HERO_STAT_DEFS: Array<{
  labelKey: string;
  valueKey: string | null;
  valueFixed: string | null;
  hintKey: string;
}> = [
  { labelKey: "mc.stat.backend.label", valueKey: null, valueFixed: "/api/qcoreai/chat", hintKey: "mc.stat.backend.hint" },
  { labelKey: "mc.stat.stage.label", valueKey: "mc.stat.stage.value", valueFixed: null, hintKey: "mc.stat.stage.hint" },
  { labelKey: "mc.stat.providers.label", valueKey: null, valueFixed: "5", hintKey: "mc.stat.providers.hint" },
  { labelKey: "mc.stat.b2b.label", valueKey: "mc.stat.b2b.value", valueFixed: null, hintKey: "mc.stat.b2b.hint" },
];

const VISION_BULLET_KEYS = ["mc.vision.b1", "mc.vision.b2", "mc.vision.b3", "mc.vision.b4"];

/* ─────────────────────────────────────────────────────────────────
 * Multichat data model
 * ────────────────────────────────────────────────────────────── */

type Role =
  | "General"
  | "Code"
  | "Finance"
  | "IP/Legal"
  | "Compliance"
  | "Translator";

type ChatMsg = { role: "user" | "assistant"; content: string };

type Agent = {
  id: string;
  role: Role;
  provider: string;
  model: string;
  title: string;
  messages: ChatMsg[];
  busy: boolean;
  /** When set, replaces ROLE_SYSTEM_PROMPT[role] for this agent only. */
  customSystemPrompt?: string;
};

type ProviderInfo = {
  id: string;
  name: string;
  models: string[];
  defaultModel: string;
  configured: boolean;
};

type UserContext = {
  email?: string;
  accountId?: string;
  balance?: number;
  qrightCount?: number;
};

type Workspace = {
  name: string;
  savedAt: string; // ISO timestamp
  agents: Agent[];
};

const STORAGE_KEY = "aevion_multichat_v1";
const DEMO_FLAG = "aevion_multichat_demo_seeded_v1";
const WORKSPACES_KEY = "aevion_multichat_workspaces_v1";
const MAX_WORKSPACES = 10;
const MAX_AGENTS = 6;
const MAX_MESSAGES_KEPT = 50;

const ROLES: Role[] = [
  "General",
  "Code",
  "Finance",
  "IP/Legal",
  "Compliance",
  "Translator",
];

const ROLE_COLORS: Record<Role, { bg: string; border: string; fg: string }> = {
  General:    { bg: "rgba(94,234,212,0.18)",  border: "rgba(94,234,212,0.45)",  fg: "#5eead4" },
  Code:       { bg: "rgba(125,211,252,0.18)", border: "rgba(125,211,252,0.45)", fg: "#7dd3fc" },
  Finance:    { bg: "rgba(250,204,21,0.18)",  border: "rgba(250,204,21,0.45)",  fg: "#facc15" },
  "IP/Legal": { bg: "rgba(196,181,253,0.18)", border: "rgba(196,181,253,0.45)", fg: "#c4b5fd" },
  Compliance: { bg: "rgba(248,113,113,0.18)", border: "rgba(248,113,113,0.45)", fg: "#fca5a5" },
  Translator: { bg: "rgba(134,239,172,0.18)", border: "rgba(134,239,172,0.45)", fg: "#86efac" },
};

const ROLE_SYSTEM_PROMPT: Record<Role, string> = {
  General:
    "You are a helpful AEVION assistant. Be concise, clear and friendly. Answer in the user's language.",
  Code:
    "You are a senior software engineer. Output runnable, idiomatic code with brief explanations. Prefer TypeScript / Node / React unless told otherwise.",
  Finance:
    "You are a quantitative finance analyst for AEVION Bank users. Reason about portfolios, royalties, cashflow and risk. Cite assumptions. Never give specific investment advice.",
  "IP/Legal":
    "You are an IP and contract lawyer working inside AEVION QRight. Identify risks, suggest clauses, and flag jurisdiction issues. You are not a substitute for a licensed attorney — say so when relevant.",
  Compliance:
    "You are a compliance officer covering KYC, AML, data privacy (GDPR), sanctions and audit. Be cautious, structured, and cite regulation names where possible.",
  Translator:
    "You are a professional translator. Detect the source language, then translate into the target language requested by the user (default: English). Preserve tone and terminology.",
};

const DEMO_REPLIES: Record<Role, string> = {
  General:
    "(demo) The live AI engine is unreachable right now. In production I would route your question through QCoreAI and return a concise answer here.",
  Code:
    "(demo) Here is a refactored version:\n\n```ts\nfunction example(x: number) {\n  return x * 2;\n}\n```\nThe live engine is offline; this is a stub response.",
  Finance:
    "(demo) Based on a hypothetical portfolio: ~62% equities, ~28% fixed income, ~10% cash. Sharpe ~0.9. The live engine is offline; this is a stub response.",
  "IP/Legal":
    "(demo) Two clauses to review: (1) assignment of derivative works, (2) jurisdiction. Recommend escrowing source via QSign. Live engine offline.",
  Compliance:
    "(demo) Suggested KYC tier: T2 (PEP screening + proof of address). Logged for audit. Live engine offline.",
  Translator:
    "(demo) Source: en → Target: ru. \"Hello\" → \"Привет\". Live engine offline.",
};

/* Shorter pretty model names — same map as /qcoreai */
const prettyModel = (m: string) => {
  const map: Record<string, string> = {
    "claude-sonnet-4-20250514": "Claude Sonnet 4",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.0-flash-001": "Gemini 2.0 Flash",
    "gemini-2.0-flash": "Gemini 2.0 Flash",
    "gemini-1.5-pro": "Gemini 1.5 Pro",
    "deepseek-chat": "DeepSeek Chat",
    "deepseek-reasoner": "DeepSeek Reasoner",
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  };
  return map[m] || m;
};

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`);

const titleFromMessage = (role: Role, content: string) => {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (!trimmed) return role;
  const snippet = trimmed.length > 36 ? `${trimmed.slice(0, 33)}…` : trimmed;
  return `${role} · ${snippet}`;
};

/* ─────────────────────────────────────────────────────────────────
 * Cross-agent handoff via @mention
 * Lets a user write "@finance forecast next quarter" inside a Code
 * panel — message is forwarded to a Finance agent, reply comes back
 * into the Code panel marked "↪ via @finance".
 * ────────────────────────────────────────────────────────────── */

const MENTION_ALIAS: Record<string, Role> = {
  general: "General",
  code: "Code",
  dev: "Code",
  engineer: "Code",
  finance: "Finance",
  cfo: "Finance",
  money: "Finance",
  legal: "IP/Legal",
  ip: "IP/Legal",
  iplegal: "IP/Legal",
  lawyer: "IP/Legal",
  compliance: "Compliance",
  kyc: "Compliance",
  aml: "Compliance",
  translator: "Translator",
  translate: "Translator",
  tr: "Translator",
};

const ROLE_TAG: Record<Role, string> = {
  General: "general",
  Code: "code",
  Finance: "finance",
  "IP/Legal": "legal",
  Compliance: "compliance",
  Translator: "translator",
};

const MENTION_RE = /^@([a-zA-Z][a-zA-Z/]*)\s+([\s\S]+)$/;

function parseMention(raw: string): { role: Role | null; body: string } {
  const m = raw.match(MENTION_RE);
  if (!m) return { role: null, body: raw };
  const key = m[1].toLowerCase().replace(/\//g, "");
  const role = MENTION_ALIAS[key] ?? null;
  if (!role) return { role: null, body: raw };
  return { role, body: m[2].trim() };
}

/* ─────────────────────────────────────────────────────────────────
 * Export a single agent's conversation as Markdown or JSON download
 * ────────────────────────────────────────────────────────────── */

function exportConversation(agent: Agent, format: "md" | "json") {
  if (typeof window === "undefined") return;
  let content = "";
  let mime = "text/plain";

  if (format === "json") {
    content = JSON.stringify(
      {
        role: agent.role,
        title: agent.title,
        provider: agent.provider,
        model: agent.model,
        customSystemPrompt: agent.customSystemPrompt ?? null,
        messages: agent.messages,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
    mime = "application/json";
  } else {
    const lines: string[] = [
      `# ${agent.title}`,
      "",
      `- **Role:** ${agent.role}`,
      `- **Provider:** ${agent.provider}`,
      `- **Model:** ${agent.model}`,
      `- **Exported:** ${new Date().toISOString()}`,
    ];
    if (agent.customSystemPrompt?.trim()) {
      lines.push(`- **System prompt:** custom (overrides default)`);
    }
    lines.push("", "---", "");
    for (const m of agent.messages) {
      const author = m.role === "user" ? "**You**" : `**${agent.role}**`;
      lines.push(author, "", m.content, "", "---", "");
    }
    content = lines.join("\n");
    mime = "text/markdown";
  }

  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `multichat-${agent.role.toLowerCase().replace(/\W/g, "")}-${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ─────────────────────────────────────────────────────────────────
 * Shareable workspace links — base64(JSON) of a slim agent dump in
 * the ?ws= query param. Round-trips through clipboard.
 * ────────────────────────────────────────────────────────────── */

function encodeWorkspaceUrlParam(agents: Agent[]): string {
  const slim = agents.map((a) => ({
    role: a.role,
    provider: a.provider,
    model: a.model,
    title: a.title,
    messages: a.messages,
    customSystemPrompt: a.customSystemPrompt,
  }));
  const json = JSON.stringify(slim);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeWorkspaceUrlParam(encoded: string): Agent[] | null {
  try {
    const padded =
      encoded.replace(/-/g, "+").replace(/_/g, "/") +
      "=".repeat((4 - (encoded.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.every(
      (a) =>
        a &&
        typeof a.role === "string" &&
        typeof a.provider === "string" &&
        typeof a.model === "string"
    );
    if (!valid) return null;
    return parsed.slice(0, MAX_AGENTS).map((a) => ({
      id: newId(),
      role: a.role as Role,
      provider: a.provider,
      model: a.model,
      title: typeof a.title === "string" ? a.title : a.role,
      messages: Array.isArray(a.messages) ? a.messages : [],
      busy: false,
      customSystemPrompt: a.customSystemPrompt,
    }));
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────
 * ?demo=1 seed — Investor pack with hand-crafted Q/A so the page
 * shows real-looking parallel reasoning before any LLM call.
 * ────────────────────────────────────────────────────────────── */

function buildDemoAgents(): Agent[] {
  const baseId = Date.now();
  const idFor = (i: number) => `demo_${baseId}_${i}`;
  return [
    {
      id: idFor(1),
      role: "General",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      title: "General · TAM for AEVION",
      busy: false,
      messages: [
        {
          role: "user",
          content: "How big is the AEVION TAM realistically?",
        },
        {
          role: "assistant",
          content:
            "AEVION targets two adjacent stacks. Creator-IP infrastructure (registry + signature + royalties) is a $14B/yr fragmentation play across collecting societies, DRM and content-ID vendors. Banking-for-creators (where royalties land and Trust Score unlocks credit) is another $40B+ slice of the long-tail SMB neobank market. The compounding insight is that we don't have to pick one — every IP filing creates a recurring royalty deposit, every royalty deposit grows Trust, every Trust tier unlocks an advance. So our TAM is best read as 'creators who need both at once', and that segment is structurally underserved.",
        },
      ],
    },
    {
      id: idFor(2),
      role: "Finance",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      title: "Finance · Bull-case Year 3 ARR",
      busy: false,
      messages: [
        {
          role: "user",
          content: "What does a bull-case Year 3 ARR scenario look like?",
        },
        {
          role: "assistant",
          content:
            "Bull case anchors on three streams: (1) SaaS — 240k creators × $24/mo Pro + 4k Enterprise seats × $99/mo = $73M ARR. (2) Royalty take-rate — 6% on $410M/yr in flowed AEC royalties = $25M ARR. (3) Bank float + advance interchange — $12M ARR on a $300M average wallet float. Total $110M ARR by EoY3, ~58% gross margin (model spend is the biggest variable cost — that's why Multichat Engine matters: centralised QCoreAI routing turns LLM cost from line-item per product into a shared platform OPEX).",
        },
      ],
    },
    {
      id: idFor(3),
      role: "IP/Legal",
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      title: "IP/Legal · Cross-border enforcement",
      busy: false,
      messages: [
        {
          role: "user",
          content:
            "How do we defend an AEVION-registered work across jurisdictions if someone strips the metadata and re-uploads?",
        },
        {
          role: "assistant",
          content:
            "Three layers, in order of speed. (1) QSign HMAC + Ed25519 ledger gives you a notarised pre-publication timestamp — admissible as evidence in EU/US/JP courts under their respective electronic-records statutes. (2) Bureau v2 lets the holder file a takedown packet with one click; we auto-generate the DMCA / EUCD-mandated counter-evidence bundle (registry hash, signature chain, prior-art search). (3) For repeat infringers, Trust Graph downgrades reputation across all 27 modules — and yes, that is contractually defensible because every party has accepted the AEVION Terms at registration. The weak spot is jurisdictions with no electronic-records statute (a few sub-Saharan markets); for those we recommend escrowing a dated paper copy via the Bureau's notary partner network.",
        },
      ],
    },
  ];
}

/* ─────────────────────────────────────────────────────────────────
 * Quick-start presets — one click spawns a curated agent bundle
 * ────────────────────────────────────────────────────────────── */

type Preset = {
  id: string;
  nameKey: string;
  descKey: string;
  roles: Role[];
};

const PRESETS: Preset[] = [
  {
    id: "investor",
    nameKey: "mc.preset.investor.name",
    descKey: "mc.preset.investor.desc",
    roles: ["General", "Finance", "IP/Legal"],
  },
  {
    id: "founder",
    nameKey: "mc.preset.founder.name",
    descKey: "mc.preset.founder.desc",
    roles: ["Code", "Finance", "Compliance"],
  },
  {
    id: "legal",
    nameKey: "mc.preset.legal.name",
    descKey: "mc.preset.legal.desc",
    roles: ["IP/Legal", "Compliance", "Translator"],
  },
  {
    id: "global",
    nameKey: "mc.preset.global.name",
    descKey: "mc.preset.global.desc",
    roles: ["General", "Translator"],
  },
  {
    id: "fullstack",
    nameKey: "mc.preset.fullstack.name",
    descKey: "mc.preset.fullstack.desc",
    roles: ["General", "Code", "Finance", "IP/Legal", "Compliance", "Translator"],
  },
];

const makeAgent = (overrides: Partial<Agent> = {}): Agent => ({
  id: newId(),
  role: "General",
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  title: "General",
  messages: [],
  busy: false,
  ...overrides,
});

/* ─────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────── */

export default function MultichatEnginePage() {
  const origin = getBackendOrigin();
  const m = launchedModules.find((x) => x.id === "multichat-engine");

  /* Module-local i18n */
  const { lang } = useI18n();
  const t = useMemo(() => makeMcT(lang), [lang]);

  /* Providers (loaded from backend, optional) */
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/qcoreai/providers"));
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.providers)) {
          setProviders(data.providers as ProviderInfo[]);
        }
      } catch {
        /* silent — provider switcher will hide gracefully */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* AEVION user context — injected into agent system prompts so
   * every panel knows who the human is (balance, IP works, …). */
  const [userCtx, setUserCtx] = useState<UserContext | null>(null);
  const [ctxEnabled, setCtxEnabled] = useState(true);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem("aevion_auth_token_v1");
    } catch {
      /* private mode — silently skip */
    }
    if (!token) return;

    let cancelled = false;
    (async () => {
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const ctx: UserContext = {};

      try {
        const r = await fetch(apiUrl("/api/auth/me"), { headers });
        if (r.ok) {
          const me = await r.json();
          ctx.email = me?.email || me?.user?.email;
        }
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(apiUrl("/api/qtrade/accounts"), { headers });
        if (r.ok) {
          const data = await r.json();
          const list = Array.isArray(data?.accounts)
            ? data.accounts
            : Array.isArray(data)
            ? data
            : null;
          if (list && list.length) {
            const acc = list[0];
            if (acc?.id) ctx.accountId = acc.id;
            if (typeof acc?.balance === "number") ctx.balance = acc.balance;
          }
        }
      } catch {
        /* ignore */
      }
      try {
        const r = await fetch(apiUrl("/api/qright/objects"), { headers });
        if (r.ok) {
          const data = await r.json();
          const objs = Array.isArray(data?.objects)
            ? data.objects
            : Array.isArray(data)
            ? data
            : null;
          if (objs) ctx.qrightCount = objs.length;
        }
      } catch {
        /* ignore */
      }

      if (cancelled) return;
      const hasAny =
        ctx.email != null ||
        ctx.balance != null ||
        ctx.accountId != null ||
        ctx.qrightCount != null;
      if (hasAny) setUserCtx(ctx);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Compose role system prompt + user context block */
  const buildSystemPrompt = useCallback(
    (agent: Agent): string => {
      const base = agent.customSystemPrompt?.trim() || ROLE_SYSTEM_PROMPT[agent.role];
      if (!ctxEnabled || !userCtx) return base;
      const lines: string[] = [
        "AEVION USER CONTEXT (the human you are talking to has a real account on AEVION):",
      ];
      if (userCtx.email) lines.push(`- Account email: ${userCtx.email}`);
      if (userCtx.accountId) lines.push(`- Wallet ID: ${userCtx.accountId}`);
      if (userCtx.balance != null)
        lines.push(`- Current AEC balance: ${userCtx.balance.toLocaleString("en-US")}`);
      if (userCtx.qrightCount != null)
        lines.push(`- Registered IP works on QRight: ${userCtx.qrightCount}`);
      lines.push(
        "Use these facts when they are relevant to the user's question. Do not list them back unless asked."
      );
      return `${lines.join("\n")}\n\n${base}`;
    },
    [ctxEnabled, userCtx]
  );

  /* Agents — restore from localStorage on mount */
  const [agents, setAgents] = useState<Agent[]>([makeAgent()]);
  const [hydrated, setHydrated] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  /* Always-current ref for cross-agent handoff lookup */
  const agentsRef = useRef<Agent[]>(agents);
  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    let wantDemo = false;
    let sharedAgents: Agent[] | null = null;
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        wantDemo = params.get("demo") === "1";
        const wsParam = params.get("ws");
        if (wsParam) {
          const decoded = decodeWorkspaceUrlParam(wsParam);
          if (decoded && decoded.length > 0) sharedAgents = decoded;
        }
      } catch {
        /* ignore */
      }
    }

    if (sharedAgents) {
      const ok = window.confirm(
        `Load shared workspace (${sharedAgents.length} agent${sharedAgents.length === 1 ? "" : "s"})? Your current panels will be replaced.`
      );
      if (ok) {
        setAgents(sharedAgents);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedAgents));
        } catch {
          /* ignore */
        }
        // Drop ?ws= from the URL so a refresh doesn't re-prompt
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete("ws");
          window.history.replaceState(null, "", url.toString());
        } catch {
          /* ignore */
        }
        setHydrated(true);
        return;
      }
      // User declined — fall through to normal hydration, but strip ?ws=
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("ws");
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* ignore */
      }
    }

    let alreadySeeded = false;
    try {
      alreadySeeded = localStorage.getItem(DEMO_FLAG) === "1";
    } catch {
      /* ignore */
    }

    if (wantDemo && !alreadySeeded) {
      const seeded = buildDemoAgents();
      setAgents(seeded);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        localStorage.setItem(DEMO_FLAG, "1");
      } catch {
        /* ignore */
      }
      setDemoMode(true);
      setHydrated(true);
      return;
    }

    if (wantDemo && alreadySeeded) setDemoMode(true);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strip any stuck busy flags from a previous session.
          setAgents(
            parsed.slice(0, MAX_AGENTS).map((a: Agent) => ({ ...a, busy: false }))
          );
        }
      }
    } catch {
      /* ignore corrupted state */
    }
    setHydrated(true);
  }, []);

  const resetDemo = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(DEMO_FLAG);
    } catch {
      /* ignore */
    }
    setAgents([makeAgent()]);
    setDemoMode(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("demo");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
    } catch {
      /* quota / privacy mode — ignore */
    }
  }, [agents, hydrated]);

  /* Agent operations */
  const addAgent = useCallback(() => {
    setAgents((cur) => {
      if (cur.length >= MAX_AGENTS) return cur;
      // Pick the next role that isn't already used, fall back to General
      const used = new Set(cur.map((a) => a.role));
      const nextRole = ROLES.find((r) => !used.has(r)) ?? "General";
      return [...cur, makeAgent({ role: nextRole, title: nextRole })];
    });
  }, []);

  const removeAgent = useCallback((id: string) => {
    setAgents((cur) => {
      const next = cur.filter((a) => a.id !== id);
      return next.length === 0 ? [makeAgent()] : next;
    });
  }, []);

  const updateAgent = useCallback(
    (id: string, patch: Partial<Agent> | ((a: Agent) => Partial<Agent>)) => {
      setAgents((cur) =>
        cur.map((a) => {
          if (a.id !== id) return a;
          const p = typeof patch === "function" ? patch(a) : patch;
          return { ...a, ...p };
        })
      );
    },
    []
  );

  const clearAll = useCallback(() => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(t("mc.live.confirm.wipe"));
    if (!ok) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setAgents([makeAgent()]);
  }, [t]);

  /* Saved workspaces — named bundles in localStorage */
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WORKSPACES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWorkspaces(parsed as Workspace[]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistWorkspaces = useCallback((next: Workspace[]) => {
    try {
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const saveWorkspace = useCallback(() => {
    if (typeof window === "undefined") return;
    const raw = window.prompt("Name this workspace:");
    const name = raw?.trim();
    if (!name) return;
    const cur = agentsRef.current;
    const ws: Workspace = {
      name,
      savedAt: new Date().toISOString(),
      agents: cur.map((a) => ({ ...a, busy: false })),
    };
    setWorkspaces((prev) => {
      const filtered = prev.filter((w) => w.name !== ws.name);
      const next = [...filtered, ws].slice(-MAX_WORKSPACES);
      persistWorkspaces(next);
      return next;
    });
  }, [persistWorkspaces]);

  const loadWorkspace = useCallback(
    (ws: Workspace) => {
      if (typeof window === "undefined") return;
      const cur = agentsRef.current;
      const hasHistory = cur.some((a) => a.messages.length > 0);
      if (hasHistory) {
        const ok = window.confirm(
          `Replace current panels with workspace "${ws.name}"?`
        );
        if (!ok) return;
      }
      setAgents(ws.agents.map((a) => ({ ...a, busy: false })));
      setLoadMenuOpen(false);
    },
    []
  );

  const shareWorkspace = useCallback(async () => {
    if (typeof window === "undefined") return;
    const cur = agentsRef.current;
    const encoded = encodeWorkspaceUrlParam(cur);
    const url = new URL(window.location.href);
    url.searchParams.delete("demo");
    url.searchParams.set("ws", encoded);
    const link = url.toString();
    let copied = false;
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
    } catch {
      /* clipboard API unavailable — fall through */
    }
    if (copied) {
      window.alert(`Share link copied to clipboard (${(link.length / 1024).toFixed(1)} KB).`);
    } else {
      window.prompt("Copy this share link:", link);
    }
  }, []);

  const deleteWorkspace = useCallback(
    (name: string) => {
      setWorkspaces((prev) => {
        const next = prev.filter((w) => w.name !== name);
        persistWorkspaces(next);
        return next;
      });
    },
    [persistWorkspaces]
  );

  /* Fork an agent's conversation: clone with messages[0..upTo] kept */
  const forkAgent = useCallback((src: Agent, upToIndex: number) => {
    let createdId: string | null = null;
    setAgents((cur) => {
      if (cur.length >= MAX_AGENTS) return cur;
      const id = newId();
      createdId = id;
      const slicedMessages = src.messages.slice(0, upToIndex + 1);
      const firstUser = slicedMessages.find((m) => m.role === "user");
      const titleSeed = firstUser?.content ?? src.role;
      const next: Agent = {
        id,
        role: src.role,
        provider: src.provider,
        model: src.model,
        title: titleFromMessage(src.role, titleSeed),
        messages: slicedMessages,
        busy: false,
        customSystemPrompt: src.customSystemPrompt,
      };
      return [...cur, next];
    });
    setTimeout(() => {
      if (typeof document === "undefined" || !createdId) return;
      const articles = document.querySelectorAll<HTMLElement>("[data-mc-role]");
      const last = articles[articles.length - 1];
      if (!last) return;
      last.scrollIntoView({ behavior: "smooth", block: "center" });
      const prev = last.style.boxShadow;
      last.style.boxShadow =
        "0 0 0 3px #5eead4, 0 8px 32px rgba(94,234,212,0.4)";
      setTimeout(() => {
        last.style.boxShadow = prev;
      }, 1200);
    }, 100);
  }, []);

  /* Replace the current agent set with a preset bundle */
  const applyPreset = useCallback((preset: Preset) => {
    if (typeof window === "undefined") return;
    const cur = agentsRef.current;
    const hasHistory = cur.some((a) => a.messages.length > 0);
    if (hasHistory) {
      const ok = window.confirm(
        t("mc.live.confirm.preset", {
          cur: cur.length,
          name: t(preset.nameKey),
          n: preset.roles.length,
        })
      );
      if (!ok) return;
    }
    setAgents(
      preset.roles
        .slice(0, MAX_AGENTS)
        .map((role) => makeAgent({ role, title: role }))
    );
    setTimeout(() => {
      const el = document.getElementById("live");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [t]);

  /* Low-level: call /api/qcoreai/chat with role+model+history, get reply */
  const callChat = useCallback(
    async (role: Role, systemPrompt: string, provider: string, model: string, history: ChatMsg[]): Promise<{ reply: string; demo: boolean }> => {
      const apiMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((mm) => ({ role: mm.role, content: mm.content })),
      ];
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        try {
          const t = localStorage.getItem("aevion_auth_token_v1");
          if (t) headers.Authorization = `Bearer ${t}`;
        } catch {
          /* ignore */
        }
        const body: Record<string, unknown> = { messages: apiMessages };
        if (provider) body.provider = provider;
        if (model) body.model = model;
        const res = await fetch(apiUrl("/api/qcoreai/chat"), {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (typeof data?.reply === "string") return { reply: data.reply, demo: false };
        if (typeof data?.content === "string") return { reply: data.content, demo: false };
        return { reply: JSON.stringify(data, null, 2), demo: false };
      } catch {
        return { reply: DEMO_REPLIES[role], demo: true };
      }
    },
    []
  );

  /* Send message for a specific agent — supports @mention handoff */
  const sendMessage = useCallback(
    async (agentId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      /* ── Broadcast branch: @all fans the message out to every other panel ── */
      const broadcastMatch = trimmed.match(/^@all\s+([\s\S]+)$/i);
      if (broadcastMatch) {
        const body = broadcastMatch[1].trim();
        const cur = agentsRef.current;
        const sourceAgent = cur.find((a) => a.id === agentId);
        if (!sourceAgent) return;
        const others = cur.filter((a) => a.id !== agentId);

        if (others.length === 0) {
          setAgents((curS) =>
            curS.map((a) => {
              if (a.id !== agentId) return a;
              const next: ChatMsg[] = [
                ...a.messages,
                { role: "user" as const, content: trimmed },
                {
                  role: "assistant" as const,
                  content:
                    "@all needs at least one other agent. Spawn another panel and try again.",
                },
              ].slice(-MAX_MESSAGES_KEPT);
              return {
                ...a,
                messages: next,
                title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
                busy: false,
              };
            })
          );
          return;
        }

        const sourceTag = ROLE_TAG[sourceAgent.role];
        const inboundMsg = `↪ broadcast from @${sourceTag}: ${body}`;

        // 1) Append user msg in source + mark every panel busy
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id === agentId) {
              const next: ChatMsg[] = [
                ...a.messages,
                { role: "user" as const, content: trimmed },
              ].slice(-MAX_MESSAGES_KEPT);
              return {
                ...a,
                messages: next,
                title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
                busy: true,
              };
            }
            if (others.some((o) => o.id === a.id)) {
              const next: ChatMsg[] = [
                ...a.messages,
                { role: "user" as const, content: inboundMsg },
              ].slice(-MAX_MESSAGES_KEPT);
              return {
                ...a,
                messages: next,
                title: a.messages.length === 0 ? titleFromMessage(a.role, body) : a.title,
                busy: true,
              };
            }
            return a;
          })
        );

        // 2) Fan out in parallel
        const results = await Promise.all(
          others.map(async (target) => {
            const targetHistory: ChatMsg[] = [
              ...target.messages,
              { role: "user" as const, content: inboundMsg },
            ];
            const { reply } = await callChat(
              target.role,
              buildSystemPrompt(target),
              target.provider,
              target.model,
              targetHistory
            );
            return { target, reply };
          })
        );

        // 3) Settle each target panel with its own reply
        setAgents((curS) =>
          curS.map((a) => {
            const r = results.find((x) => x.target.id === a.id);
            if (!r) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: r.reply },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );

        // 4) Settle source with one combined assistant msg listing every reply
        const summary = results
          .map(({ target, reply }) => `↪ via @${ROLE_TAG[target.role]}\n${reply}`)
          .join("\n\n———\n\n");
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: summary },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );
        return;
      }

      const { role: mentionRole, body: mentionBody } = parseMention(trimmed);
      const cur = agentsRef.current;
      const sourceAgent = cur.find((a) => a.id === agentId);
      if (!sourceAgent) return;

      const target = mentionRole
        ? cur.find((a) => a.role === mentionRole && a.id !== agentId)
        : null;

      /* ── Handoff branch: forward to target, return reply to both ── */
      if (mentionRole && target) {
        // 1) Append the @mention prompt in source as user msg + mark busy
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: trimmed },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
              busy: true,
            };
          })
        );

        // 2) Append in target (visible "↪ from @<src>" so target user knows context)
        const sourceTag = ROLE_TAG[sourceAgent.role];
        const inboundMsg = `↪ from @${sourceTag}: ${mentionBody}`;
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== target.id) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: inboundMsg },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, mentionBody) : a.title,
              busy: true,
            };
          })
        );

        // Build target history from current state (post-append) for the call
        const targetHistory = [
          ...target.messages,
          { role: "user" as const, content: inboundMsg },
        ];

        const { reply } = await callChat(target.role, buildSystemPrompt(target), target.provider, target.model, targetHistory);

        // 3) Append assistant reply in TARGET (normal)
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== target.id) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: reply },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );

        // 4) Append assistant reply in SOURCE with "↪ via @<target>" prefix
        const targetTag = ROLE_TAG[target.role];
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "assistant" as const, content: `↪ via @${targetTag}\n${reply}` },
            ].slice(-MAX_MESSAGES_KEPT);
            return { ...a, messages: next, busy: false };
          })
        );
        return;
      }

      /* ── Mention requested but no matching agent active ── */
      if (mentionRole && !target) {
        setAgents((curS) =>
          curS.map((a) => {
            if (a.id !== agentId) return a;
            const next: ChatMsg[] = [
              ...a.messages,
              { role: "user" as const, content: trimmed },
              {
                role: "assistant" as const,
                content: t("mc.handoff.noTarget", {
                  tag: ROLE_TAG[mentionRole],
                  role: mentionRole,
                }),
              },
            ].slice(-MAX_MESSAGES_KEPT);
            return {
              ...a,
              messages: next,
              title: a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title,
              busy: false,
            };
          })
        );
        return;
      }

      /* ── Normal (no-mention) branch ── */
      let snapshot: Agent | undefined;
      setAgents((curS) =>
        curS.map((a) => {
          if (a.id !== agentId) return a;
          const nextMessages: ChatMsg[] = [
            ...a.messages,
            { role: "user" as const, content: trimmed },
          ].slice(-MAX_MESSAGES_KEPT);
          const nextTitle =
            a.messages.length === 0 ? titleFromMessage(a.role, trimmed) : a.title;
          const updated: Agent = {
            ...a,
            messages: nextMessages,
            title: nextTitle,
            busy: true,
          };
          snapshot = updated;
          return updated;
        })
      );
      if (!snapshot) return;

      const { reply } = await callChat(snapshot.role, buildSystemPrompt(snapshot), snapshot.provider, snapshot.model, snapshot.messages);

      setAgents((curS) =>
        curS.map((a) => {
          if (a.id !== agentId) return a;
          const nextMessages: ChatMsg[] = [
            ...a.messages,
            { role: "assistant" as const, content: reply },
          ].slice(-MAX_MESSAGES_KEPT);
          return { ...a, messages: nextMessages, busy: false };
        })
      );
    },
    [callChat, buildSystemPrompt, t]
  );

  /* Layout: 1 col → 1, 2-3 → auto-fit, 4+ → 2 cols (CSS handles mobile) */
  const gridStyle = useMemo<React.CSSProperties>(() => {
    const n = agents.length;
    if (n <= 1) return { display: "grid", gridTemplateColumns: "1fr", gap: 16 };
    if (n <= 3)
      return {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 16,
      };
    return {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 16,
    };
  }, [agents.length]);

  return (
    <div style={{ background: "#020617", color: "#e2e8f0", minHeight: "100vh" }}>
      <section
        style={{
          position: "relative",
          minHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 24px 56px",
          overflow: "hidden",
        }}
      >
        <div className="demo-aurora" aria-hidden />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          <Wave1Nav variant="dark" />
          {demoMode ? (
            <div
              role="status"
              style={{
                marginBottom: 18,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(251,191,36,0.4)",
                background: "rgba(251,191,36,0.12)",
                color: "#fde68a",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 800, letterSpacing: "0.05em" }}>DEMO</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                3 agents pre-loaded with hand-crafted answers — perfect for screenshots and live pitches.
              </span>
              <button
                type="button"
                onClick={resetDemo}
                style={{
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(251,191,36,0.5)",
                  background: "rgba(251,191,36,0.2)",
                  color: "#fef3c7",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
              >
                Reset
              </button>
            </div>
          ) : null}
          <p
            style={{
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.95)",
              marginBottom: 16,
            }}
          >
            {t("mc.badge")}
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 900,
              lineHeight: 1.05,
              margin: "0 0 20px",
              letterSpacing: "-0.04em",
              background: "linear-gradient(120deg, #fff 0%, #99f6e4 45%, #7dd3fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {t("mc.title.a")}
            <br />
            <span style={{ fontSize: "0.62em", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {t("mc.title.b")}
            </span>
          </h1>
          <p
            style={{
              fontSize: "clamp(16px, 2.4vw, 20px)",
              lineHeight: 1.55,
              maxWidth: 760,
              color: "rgba(226,232,240,0.92)",
              margin: 0,
            }}
          >
            {m?.tagline ?? t("mc.subtitle.fallback")}
          </p>

          <div
            style={{
              marginTop: 32,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
            }}
          >
            {HERO_STAT_DEFS.map((s) => {
              const value = s.valueFixed ?? (s.valueKey ? t(s.valueKey) : "");
              return (
                <div
                  key={s.labelKey}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "1px solid rgba(94,234,212,0.25)",
                    background: "rgba(15,23,42,0.65)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", color: "#5eead4", textTransform: "uppercase" }}>
                    {t(s.labelKey)}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.01em" }}>
                    {value}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: "#94a3b8", lineHeight: 1.4 }}>{t(s.hintKey)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href="#live"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 16,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              {t("mc.cta.try")}
            </a>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              {t("mc.cta.single")}
            </Link>
            <a
              href={`${origin}/api/qcoreai/health`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "14px 28px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 16,
              }}
            >
              {t("mc.cta.health")}
            </a>
          </div>

          {/* Personalisation strip — visible only when we have any AEVION context */}
          {userCtx ? (
            <div
              style={{
                marginTop: 22,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid rgba(94,234,212,0.25)",
                background: "rgba(15,23,42,0.55)",
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                fontSize: 13,
                color: "#cbd5e1",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "#5eead4",
                }}
              >
                {t("mc.ctx.label")}
              </span>
              {userCtx.email ? <span>· {userCtx.email}</span> : null}
              {userCtx.balance != null ? (
                <span>· {userCtx.balance.toLocaleString("en-US")} AEC</span>
              ) : null}
              {userCtx.qrightCount != null && userCtx.qrightCount > 0 ? (
                <span>
                  · {t(userCtx.qrightCount === 1 ? "mc.ctx.work" : "mc.ctx.works", { n: userCtx.qrightCount })}
                </span>
              ) : null}
              <label
                style={{
                  marginLeft: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  color: ctxEnabled ? "#5eead4" : "#94a3b8",
                  fontWeight: 700,
                }}
                title={t("mc.ctx.toggle.title")}
              >
                <input
                  type="checkbox"
                  checked={ctxEnabled}
                  onChange={(e) => setCtxEnabled(e.target.checked)}
                  style={{ accentColor: "#5eead4" }}
                />
                {t("mc.ctx.toggle")}
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 24px 80px" }}>
        <PitchValueCallout moduleId="multichat-engine" variant="dark" />

        <section
          style={{
            marginTop: 24,
            padding: 28,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(15,118,110,0.15))",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#5eead4", marginBottom: 10, textTransform: "uppercase" }}>
            {t("mc.vision.eyebrow")}
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 14px", color: "#fff", letterSpacing: "-0.02em" }}>
            {t("mc.vision.title")}
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 20px" }}>
            {m?.problem ?? t("mc.vision.body.fallback")}
          </p>
          <ul style={{ margin: 0, paddingLeft: 22, color: "#e2e8f0", lineHeight: 1.75, fontSize: 15 }}>
            {VISION_BULLET_KEYS.map((k) => (
              <li key={k} style={{ marginBottom: 10 }}>
                {t(k)}
              </li>
            ))}
          </ul>
        </section>

        {/* ──────────────────────────────────────────────────────
         *  Quick-start presets
         * ────────────────────────────────────────────────────── */}
        <section
          style={{
            marginTop: 32,
            padding: 24,
            borderRadius: 20,
            border: "1px solid rgba(148,163,184,0.2)",
            background: "rgba(15,23,42,0.55)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#fbbf24", textTransform: "uppercase", marginBottom: 4 }}>
                {t("mc.preset.eyebrow")}
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>
                {t("mc.preset.title")}
              </h2>
            </div>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              {t("mc.preset.note")}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                style={{
                  textAlign: "left",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(94,234,212,0.25)",
                  background: "rgba(15,23,42,0.7)",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  transition: "transform .15s, border-color .15s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(94,234,212,0.6)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(94,234,212,0.25)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc", marginBottom: 4 }}>
                  {t(p.nameKey)}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5, marginBottom: 10 }}>
                  {t(p.descKey)}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {p.roles.map((r) => {
                    const c = ROLE_COLORS[r];
                    return (
                      <span
                        key={r}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          padding: "2px 7px",
                          borderRadius: 999,
                          background: c.bg,
                          color: c.fg,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {r}
                      </span>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────
         *  LIVE: parallel agent grid
         * ────────────────────────────────────────────────────── */}
        <section
          id="live"
          style={{
            marginTop: 40,
            padding: 24,
            borderRadius: 20,
            border: "1px solid rgba(94,234,212,0.25)",
            background: "linear-gradient(165deg, rgba(15,23,42,0.9), rgba(13,148,136,0.10))",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  color: "#5eead4",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}
              >
                {t("mc.live.eyebrow")}
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  margin: 0,
                  color: "#fff",
                  letterSpacing: "-0.02em",
                }}
              >
                {t(agents.length === 1 ? "mc.live.count.one" : "mc.live.count.many", {
                  n: agents.length,
                  max: MAX_AGENTS,
                })}
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={addAgent}
                disabled={agents.length >= MAX_AGENTS}
                style={{
                  padding: "10px 18px",
                  borderRadius: 10,
                  border: "1px solid rgba(94,234,212,0.45)",
                  background:
                    agents.length >= MAX_AGENTS
                      ? "rgba(94,234,212,0.06)"
                      : "linear-gradient(135deg, rgba(13,148,136,0.6), rgba(14,165,233,0.55))",
                  color: agents.length >= MAX_AGENTS ? "#475569" : "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: agents.length >= MAX_AGENTS ? "not-allowed" : "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {t("mc.live.spawn")}
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(248,113,113,0.35)",
                  background: "rgba(248,113,113,0.08)",
                  color: "#fca5a5",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                {t("mc.live.clearAll")}
              </button>
              <button
                type="button"
                onClick={saveWorkspace}
                title="Save current panels as a named workspace"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "rgba(15,23,42,0.65)",
                  color: "#cbd5e1",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                💾 Save
              </button>
              <button
                type="button"
                onClick={shareWorkspace}
                title="Copy a shareable link to current panels"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(94,234,212,0.45)",
                  background: "rgba(13,148,136,0.18)",
                  color: "#5eead4",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  letterSpacing: "0.02em",
                }}
              >
                🔗 Share
              </button>
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setLoadMenuOpen((v) => !v)}
                  disabled={workspaces.length === 0}
                  title={workspaces.length === 0 ? "No saved workspaces yet" : "Load a saved workspace"}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(15,23,42,0.65)",
                    color: workspaces.length === 0 ? "#475569" : "#cbd5e1",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: workspaces.length === 0 ? "not-allowed" : "pointer",
                    letterSpacing: "0.02em",
                  }}
                >
                  📂 Load{workspaces.length > 0 ? ` (${workspaces.length})` : ""}
                </button>
                {loadMenuOpen && workspaces.length > 0 ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 10,
                      minWidth: 240,
                      maxHeight: 320,
                      overflowY: "auto",
                      padding: 6,
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "rgba(2,6,23,0.95)",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                    }}
                  >
                    {[...workspaces].reverse().map((ws) => (
                      <div
                        key={ws.name}
                        style={{
                          display: "flex",
                          gap: 6,
                          alignItems: "stretch",
                          padding: 4,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => loadWorkspace(ws)}
                          style={{
                            flex: 1,
                            textAlign: "left",
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid transparent",
                            background: "transparent",
                            color: "#e2e8f0",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(94,234,212,0.08)";
                            e.currentTarget.style.borderColor = "rgba(94,234,212,0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "transparent";
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{ws.name}</div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                            {ws.agents.length} agent{ws.agents.length === 1 ? "" : "s"} ·{" "}
                            {new Date(ws.savedAt).toLocaleDateString()}
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteWorkspace(ws.name)}
                          title={`Delete "${ws.name}"`}
                          style={{
                            padding: "0 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(248,113,113,0.3)",
                            background: "rgba(248,113,113,0.06)",
                            color: "#fca5a5",
                            cursor: "pointer",
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="multichat-grid" style={gridStyle}>
            {agents.map((a) => (
              <AgentPanel
                key={a.id}
                agent={a}
                providers={providers}
                onChange={(patch) => updateAgent(a.id, patch)}
                onClose={() => removeAgent(a.id)}
                onSend={(text) => sendMessage(a.id, text)}
                onFork={(idx) => forkAgent(a, idx)}
                canFork={agents.length < MAX_AGENTS}
                t={t}
              />
            ))}
          </div>
        </section>

        {m ? (
          <section
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 16,
              border: "1px solid rgba(59,130,246,0.25)",
              background: "rgba(30,58,138,0.18)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", marginBottom: 10, textTransform: "uppercase" }}>
              {t("mc.killer.eyebrow")}
            </div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: "#dbeafe" }}>{m.killerFeature}</p>
            <div style={{ marginTop: 14, fontSize: 11, fontWeight: 800, letterSpacing: "0.2em", color: "#93c5fd", textTransform: "uppercase" }}>
              {t("mc.network.eyebrow")}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.65, color: "#cbd5e1" }}>{m.networkRole}</p>
          </section>
        ) : null}

        <footer
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid rgba(51,65,85,0.5)",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
            {t("mc.footer.body")}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/pitch"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              {t("mc.footer.pitch")}
            </Link>
            <Link
              href="/demo"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "rgba(148,163,184,0.12)",
                border: "1px solid rgba(148,163,184,0.35)",
                color: "#e2e8f0",
                fontWeight: 750,
                textDecoration: "none",
                fontSize: 15,
              }}
            >
              {t("mc.footer.demo")}
            </Link>
            <Link
              href="/qcoreai"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                borderRadius: 12,
                background: "linear-gradient(135deg, #0d9488, #0ea5e9)",
                color: "#fff",
                fontWeight: 800,
                textDecoration: "none",
                fontSize: 15,
                boxShadow: "0 8px 32px rgba(13,148,136,0.35)",
              }}
            >
              {t("mc.footer.qcoreai")}
            </Link>
          </div>
        </footer>
      </div>

      {/* Inline keyframes + responsive grid (no global CSS edits) */}
      <style jsx>{`
        @keyframes mc-blink {
          0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
          40%           { opacity: 1;   transform: translateY(-2px); }
        }
        @media (max-width: 720px) {
          :global(.multichat-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Sub-component: per-agent panel
 * ────────────────────────────────────────────────────────────── */

function AgentPanel(props: {
  agent: Agent;
  providers: ProviderInfo[];
  onChange: (patch: Partial<Agent> | ((a: Agent) => Partial<Agent>)) => void;
  onClose: () => void;
  onSend: (text: string) => void;
  onFork: (messageIndex: number) => void;
  canFork: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const { agent, providers, onChange, onClose, onSend, onFork, canFork, t } = props;
  const [hoveredMsg, setHoveredMsg] = useState<number | null>(null);

  // @-autocomplete state
  const AUTOCOMPLETE_TAGS = ["all", "code", "finance", "legal", "compliance", "translator", "general"];
  const [acIndex, setAcIndex] = useState(0);
  const [input, setInput] = useState("");
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(agent.customSystemPrompt ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local draft if the agent's stored custom prompt changes externally
  useEffect(() => {
    setDraftPrompt(agent.customSystemPrompt ?? "");
  }, [agent.customSystemPrompt]);

  // Approximate tokens in this panel (system prompt + every message body)
  // — chars/4 is the universal rough heuristic used by every major tokeniser.
  const tokenEstimate = useMemo(() => {
    let chars =
      (agent.customSystemPrompt?.trim() || ROLE_SYSTEM_PROMPT[agent.role]).length;
    for (const m of agent.messages) chars += m.content.length;
    return Math.round(chars / 4);
  }, [agent.messages, agent.customSystemPrompt, agent.role]);

  const tokenLabel =
    tokenEstimate >= 1000 ? `~${(tokenEstimate / 1000).toFixed(1)}k tok` : `~${tokenEstimate} tok`;
  const tokenColor =
    tokenEstimate < 1000 ? "#475569" : tokenEstimate < 3000 ? "#fbbf24" : "#fca5a5";

  // Click on a handoff badge → scroll-into-view + flash the target panel
  const focusPanelByTag = useCallback((tag: string) => {
    if (typeof document === "undefined") return;
    const target = document.querySelector<HTMLElement>(`[data-mc-role="${tag}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const prev = target.style.boxShadow;
    target.style.boxShadow = "0 0 0 3px #fbbf24, 0 8px 32px rgba(251,191,36,0.35)";
    setTimeout(() => {
      target.style.boxShadow = prev;
    }, 1200);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [agent.messages.length, agent.busy]);

  const provider = providers.find((p) => p.id === agent.provider);
  const availableModels = provider?.models ?? [];
  const colors = ROLE_COLORS[agent.role];

  const submit = () => {
    const t = input.trim();
    if (!t || agent.busy) return;
    onSend(t);
    setInput("");
  };

  const onRoleChange = (role: Role) => {
    onChange((a) => ({
      role,
      // If the panel still has an auto-generated title (== old role), update it.
      title: a.messages.length === 0 ? role : a.title,
    }));
  };

  const onProviderChange = (providerId: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    onChange({
      provider: providerId,
      model: p?.defaultModel ?? agent.model,
    });
  };

  const visibleMessages = agent.messages.slice(-MAX_MESSAGES_KEPT);

  return (
    <article
      data-mc-role={ROLE_TAG[agent.role]}
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: "rgba(15,23,42,0.85)",
        minHeight: 480,
        overflow: "hidden",
        transition: "box-shadow 220ms ease-out",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid rgba(51,65,85,0.5)",
          background: "rgba(2,6,23,0.4)",
        }}
      >
        <select
          value={agent.role}
          onChange={(e) => onRoleChange(e.target.value as Role)}
          aria-label={t("mc.panel.role.aria")}
          style={{
            padding: "5px 8px",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.bg,
            color: colors.fg,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r} style={{ background: "#0f172a", color: "#fff" }}>
              {r}
            </option>
          ))}
        </select>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <div
            title={agent.title}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#f8fafc",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {agent.title}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {providers.length > 0 ? (
              <>
                <select
                  value={agent.provider}
                  onChange={(e) => onProviderChange(e.target.value)}
                  aria-label={t("mc.panel.provider.aria")}
                  style={{
                    padding: "2px 6px",
                    borderRadius: 6,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(15,23,42,0.6)",
                    color: "#cbd5e1",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {providers.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={!p.configured}
                      style={{ background: "#0f172a", color: "#fff" }}
                    >
                      {p.name}{p.configured ? "" : " (no key)"}
                    </option>
                  ))}
                </select>
                {availableModels.length > 0 ? (
                  <select
                    value={agent.model}
                    onChange={(e) => onChange({ model: e.target.value })}
                    aria-label={t("mc.panel.model.aria")}
                    style={{
                      padding: "2px 6px",
                      borderRadius: 6,
                      border: "1px solid rgba(148,163,184,0.25)",
                      background: "rgba(15,23,42,0.6)",
                      color: "#cbd5e1",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: "pointer",
                      maxWidth: 160,
                    }}
                  >
                    {availableModels.map((mm) => (
                      <option key={mm} value={mm} style={{ background: "#0f172a", color: "#fff" }}>
                        {prettyModel(mm)}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            ) : (
              <span style={{ fontSize: 10, color: "#64748b" }}>{prettyModel(agent.model)}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={t("mc.panel.close.aria")}
          title={t("mc.panel.close.title")}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.6)",
            color: "#94a3b8",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </header>

      {/* Per-panel toolbar: edit-prompt + export */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: "1px solid rgba(51,65,85,0.4)",
          background: "rgba(2,6,23,0.45)",
          fontSize: 11,
        }}
      >
        <button
          type="button"
          onClick={() => setEditingPrompt((v) => !v)}
          title={t("mc.panel.prompt.title")}
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            border: `1px solid ${agent.customSystemPrompt?.trim() ? "rgba(251,191,36,0.5)" : "rgba(148,163,184,0.25)"}`,
            background: agent.customSystemPrompt?.trim()
              ? "rgba(251,191,36,0.12)"
              : "rgba(15,23,42,0.55)",
            color: agent.customSystemPrompt?.trim() ? "#fbbf24" : "#94a3b8",
            cursor: "pointer",
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {agent.customSystemPrompt?.trim() ? t("mc.panel.prompt.custom") : t("mc.panel.prompt")}
        </button>
        <button
          type="button"
          onClick={() => exportConversation(agent, "md")}
          disabled={agent.messages.length === 0}
          title={t("mc.panel.export.md.title")}
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
            color: agent.messages.length === 0 ? "#475569" : "#cbd5e1",
            cursor: agent.messages.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 700,
          }}
        >
          {t("mc.panel.export.md")}
        </button>
        <button
          type="button"
          onClick={() => exportConversation(agent, "json")}
          disabled={agent.messages.length === 0}
          title={t("mc.panel.export.json.title")}
          style={{
            padding: "3px 8px",
            borderRadius: 6,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.55)",
            color: agent.messages.length === 0 ? "#475569" : "#cbd5e1",
            cursor: agent.messages.length === 0 ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {t("mc.panel.export.json")}
        </button>
        <span
          title="Approximate token count (chars/4 heuristic). Real tokenisation varies by provider."
          style={{
            marginLeft: "auto",
            color: tokenColor,
            fontSize: 10,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          {tokenLabel}
        </span>
        <span style={{ color: "#475569", fontSize: 10 }}>
          ·
        </span>
        <span style={{ color: "#475569", fontSize: 10 }}>
          {t(agent.messages.length === 1 ? "mc.panel.msg.one" : "mc.panel.msg.many", { n: agent.messages.length })}
        </span>
      </div>

      {/* Inline system-prompt editor */}
      {editingPrompt ? (
        <div
          style={{
            padding: 10,
            borderBottom: "1px solid rgba(51,65,85,0.4)",
            background: "rgba(2,6,23,0.55)",
          }}
        >
          <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {t("mc.panel.editor.label")}
          </div>
          <textarea
            value={draftPrompt}
            onChange={(e) => setDraftPrompt(e.target.value)}
            placeholder={ROLE_SYSTEM_PROMPT[agent.role]}
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 8,
              borderRadius: 8,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.7)",
              color: "#f8fafc",
              fontSize: 12,
              lineHeight: 1.4,
              fontFamily: "inherit",
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                onChange({ customSystemPrompt: draftPrompt.trim() || undefined });
                setEditingPrompt(false);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(94,234,212,0.45)",
                background: "linear-gradient(135deg, rgba(13,148,136,0.5), rgba(14,165,233,0.45))",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: "0.04em",
              }}
            >
              {t("mc.panel.editor.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftPrompt("");
                onChange({ customSystemPrompt: undefined });
                setEditingPrompt(false);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "rgba(15,23,42,0.55)",
                color: "#94a3b8",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {t("mc.panel.editor.reset")}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraftPrompt(agent.customSystemPrompt ?? "");
                setEditingPrompt(false);
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.25)",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              {t("mc.panel.editor.cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: 280,
          maxHeight: 460,
          background: "rgba(2,6,23,0.55)",
        }}
      >
        {visibleMessages.length === 0 ? (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "#64748b",
              fontSize: 13,
              padding: 20,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>◈</div>
            <div style={{ fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
              {t("mc.panel.empty.title", { role: agent.role })}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {t("mc.panel.empty.desc")}
            </div>
          </div>
        ) : (
          visibleMessages.map((mm, i) => {
            // Detect handoff messages — they carry "↪ via @x\n..." or "↪ from @x: ..."
            const handoffOut = mm.content.match(/^↪ via @(\w+)\n([\s\S]*)$/);
            const handoffIn = mm.content.match(/^↪(?:\s+broadcast)?\s+from\s+@(\w+):\s+([\s\S]*)$/);
            const userMention = mm.role === "user"
              ? mm.content.match(/^@(\w+)\s+([\s\S]+)$/)
              : null;
            const handoffTag = handoffOut?.[1] ?? handoffIn?.[1] ?? userMention?.[1] ?? null;
            const isHandoffOut = !!handoffOut;
            const isHandoffIn = !!handoffIn;
            const isUserMention = !!userMention;
            const renderBody =
              handoffOut?.[2] ?? handoffIn?.[2] ?? (userMention ? `@${userMention[1]} ${userMention[2]}` : mm.content);
            const accent = isHandoffOut || isHandoffIn || isUserMention ? "#fbbf24" : null;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredMsg(i)}
                onMouseLeave={() => setHoveredMsg((h) => (h === i ? null : h))}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 6,
                  justifyContent: mm.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {mm.role !== "user" && hoveredMsg === i && canFork ? (
                  <button
                    type="button"
                    onClick={() => onFork(i)}
                    title="Fork conversation from here"
                    aria-label="Fork conversation from here"
                    style={{
                      order: 2,
                      padding: "3px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(94,234,212,0.4)",
                      background: "rgba(15,23,42,0.85)",
                      color: "#5eead4",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ↳ Fork
                  </button>
                ) : null}
                {mm.role === "user" && hoveredMsg === i && canFork ? (
                  <button
                    type="button"
                    onClick={() => onFork(i)}
                    title="Fork conversation from here"
                    aria-label="Fork conversation from here"
                    style={{
                      padding: "3px 8px",
                      borderRadius: 8,
                      border: "1px solid rgba(94,234,212,0.4)",
                      background: "rgba(15,23,42,0.85)",
                      color: "#5eead4",
                      cursor: "pointer",
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ↳ Fork
                  </button>
                ) : null}
                <div
                  style={{
                    order: 1,
                    maxWidth: "88%",
                    padding: "9px 12px",
                    borderRadius:
                      mm.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                    background:
                      mm.role === "user"
                        ? "linear-gradient(135deg, #0d9488, #0ea5e9)"
                        : "rgba(30,41,59,0.85)",
                    color: "#f8fafc",
                    border: accent
                      ? `1px solid ${accent}`
                      : mm.role === "user"
                      ? "none"
                      : "1px solid rgba(71,85,105,0.5)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {accent && handoffTag ? (
                    <button
                      type="button"
                      onClick={() => focusPanelByTag(handoffTag)}
                      title="Jump to that agent's panel"
                      style={{
                        display: "inline-block",
                        padding: 0,
                        fontSize: 10,
                        fontWeight: 800,
                        color: accent,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 4,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        textDecorationColor: "rgba(251,191,36,0.35)",
                        fontFamily: "inherit",
                      }}
                    >
                      {isHandoffOut
                        ? `↪ via @${handoffTag}`
                        : isHandoffIn
                        ? `↪ from @${handoffTag}`
                        : `→ @${handoffTag}`}
                    </button>
                  ) : null}
                  {renderBody}
                </div>
              </div>
            );
          })
        )}

        {agent.busy ? (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div
              style={{
                padding: "9px 12px",
                borderRadius: "12px 12px 12px 4px",
                background: "rgba(30,41,59,0.85)",
                border: "1px solid rgba(71,85,105,0.5)",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
              }}
              aria-label={t("mc.panel.typing.aria")}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: colors.fg,
                    display: "inline-block",
                    animation: `mc-blink 1.2s ${i * 0.15}s infinite ease-in-out`,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div
        style={{
          position: "relative",
          padding: "10px 10px 6px",
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          borderTop: "1px solid rgba(51,65,85,0.5)",
          background: "rgba(2,6,23,0.55)",
        }}
      >
        {(() => {
          const showAc = input.startsWith("@") && !input.slice(1).includes(" ");
          const acTerm = showAc ? input.slice(1).toLowerCase() : "";
          const acFiltered = showAc
            ? AUTOCOMPLETE_TAGS.filter((s) => s.startsWith(acTerm))
            : [];
          if (!showAc || acFiltered.length === 0) return null;
          const safeIdx = Math.min(acIndex, acFiltered.length - 1);
          return (
            <div
              role="listbox"
              aria-label="Mention suggestions"
              style={{
                position: "absolute",
                bottom: "calc(100% - 1px)",
                left: 10,
                zIndex: 5,
                minWidth: 180,
                padding: 4,
                borderRadius: 10,
                border: "1px solid rgba(94,234,212,0.45)",
                background: "rgba(2,6,23,0.95)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#64748b",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "2px 8px 4px",
                  fontWeight: 700,
                }}
              >
                ↑↓ navigate · Tab/Enter insert · Esc clear
              </div>
              {acFiltered.map((tag, i) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(`@${tag} `);
                    setAcIndex(0);
                  }}
                  onMouseEnter={() => setAcIndex(i)}
                  style={{
                    display: "flex",
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid transparent",
                    background:
                      i === safeIdx ? "rgba(94,234,212,0.15)" : "transparent",
                    color: i === safeIdx ? "#5eead4" : "#cbd5e1",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, SFMono-Regular, monospace",
                    textAlign: "left",
                  }}
                >
                  @{tag}
                  {tag === "all" ? (
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#fbbf24", fontWeight: 800 }}>
                      BROADCAST
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          );
        })()}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // @-autocomplete: only when input is "@<word-no-space>"
            const showAc =
              input.startsWith("@") && !input.slice(1).includes(" ");
            const acTerm = showAc ? input.slice(1).toLowerCase() : "";
            const acFiltered = showAc
              ? AUTOCOMPLETE_TAGS.filter((s) => s.startsWith(acTerm))
              : [];

            if (showAc && acFiltered.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAcIndex((i) => (i + 1) % acFiltered.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setAcIndex(
                  (i) => (i - 1 + acFiltered.length) % acFiltered.length
                );
                return;
              }
              if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                const idx = Math.min(acIndex, acFiltered.length - 1);
                setInput(`@${acFiltered[idx]} `);
                setAcIndex(0);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setInput("");
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={t("mc.panel.placeholder", { role: agent.role })}
          disabled={agent.busy}
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(148,163,184,0.25)",
            background: "rgba(15,23,42,0.7)",
            color: "#f8fafc",
            fontSize: 13,
            lineHeight: 1.4,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={agent.busy || !input.trim()}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background:
              agent.busy || !input.trim()
                ? "rgba(94,234,212,0.18)"
                : "linear-gradient(135deg, #0d9488, #0ea5e9)",
            color: agent.busy || !input.trim() ? "#475569" : "#fff",
            fontWeight: 800,
            fontSize: 13,
            cursor: agent.busy || !input.trim() ? "not-allowed" : "pointer",
            letterSpacing: "0.02em",
          }}
        >
          {agent.busy ? "…" : t("mc.panel.send")}
        </button>
      </div>

      {/* Mention hint: tells user how to delegate to other agents */}
      <div
        style={{
          padding: "0 10px 8px",
          fontSize: 10,
          color: "#64748b",
          letterSpacing: "0.02em",
          background: "rgba(2,6,23,0.55)",
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, color: "#94a3b8" }}>{t("mc.panel.relay")}</span>
        {(["all", "code", "finance", "legal", "compliance", "translator", "general"] as const).map((tag) => (
          <span
            key={tag}
            style={{
              padding: "1px 6px",
              borderRadius: 6,
              background: "rgba(71,85,105,0.35)",
              color: "#cbd5e1",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
            }}
          >
            @{tag}
          </span>
        ))}
      </div>
    </article>
  );
}
