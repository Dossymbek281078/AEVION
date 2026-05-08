/**
 * Клиент для backend QCoreAI (POST /api/qcoreai/chat).
 * Формирует system-prompt с контекстом текущей сметы + переписку,
 * шлёт на бэкенд, парсит ответ. Graceful fallback на локальную KB
 * (askConsultant) если backend offline или провайдер не настроен (stub).
 */

import type { Lsr, LsrCalc, AiNotice } from "./types";
import type { AiMessage } from "./aiConsultant";
import { askConsultant } from "./aiConsultant";
import { formatKzt } from "./calc";

const API_BASE =
  (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_AEVION_API) ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:4001`
    : "http://localhost:4001");

const HISTORY_KEY_PREFIX = "aevion-smeta-aichat-v1:";

// ── System prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — AI-консультант по сметному делу Республики Казахстан в учебном
тренажёре AEVION (курс «Сметное дело в РК», капитальный ремонт школы №47, г. Алматы).

Аудитория: студенты 1-5 уровня (с-нуля → пользователь → ПТО → проектировщик → эксперт-сметчик).
Объясняй ясно, по делу, без воды. Если студент сделал ошибку — назови её прямо и
покажи как исправить, со ссылкой на нормативный пункт.

Нормативная база РК:
- НДЦС РК 8.01-08-2022 — Правила определения сметной стоимости (главный документ)
- ССЦ РК 8.04-08-2025 — сметные цены на материалы (приказ Комитета по делам
  строительства МПС РК № 94-НҚ от 18.06.2025, действует с 2025-07-01)
- ССЦ РК 8.04-09-2025 — сметные цены на инженерное оборудование
- СЦЗТ РК 8.04-13-2025 — сметные цены на затраты труда
- СЦЭМ РК 8.04-11-2025 — сметные цены на эксплуатацию строительных машин
- СЦПГ РК 8.04-12-2025 — сметные цены на перевозки грузов
- НДЦС РК 8.04-07-2025 — индексы стоимости (ежеквартальные)
- СН РК 8.02-07 — нормативы НР и СП по видам работ
- ЕНиР, общая часть — коэффициенты условий производства работ
- СН РК 8.02-09 — зимнее удорожание

Метод РК с 2015 — РЕСУРСНЫЙ (не базисно-индексный). ЭСН даёт нормы расхода,
ССЦ даёт текущие цены. Оба нужны параллельно.

Категории работ → группы СЦЗТ:
- 001 земляные, 002 несущие, 003 отделочные, 004 инженерные системы,
- 005 спецстрой, 007 монтаж оборудования, 009 ремонт зданий

Тренажёр умеет: ЛСР (Форма 4*), ВОР, КС-2, КС-3, ССР, дефектная ведомость,
toggle учебные/реальные цены ССЦ, редактор ресурсов расценки, AI-замечания
(7 сценариев: проёмы, двойной счёт, забытый коэф, зимнее удорожание,
несоответствие индексов, мисматч НР/СП, забытый коэф высоты).

Стиль: кратко, по-русски, с примерами и ссылками на конкретные пункты НПА РК.
Не выдумывай нормативы — если не знаешь точно, скажи «нужно свериться с НДЦС РК
8.01-08-2022, раздел X». Не отвечай на вопросы вне сметного дела РК — вежливо
перенаправь обратно к курсу.`;

// ── Контекст текущей сметы (компактный снимок) ─────────────────────────

function lsrSnapshot(lsr: Lsr, calc: LsrCalc, notices: AiNotice[]): string {
  const totalPositions = lsr.sections.reduce((s, sec) => s + sec.positions.length, 0);
  const totalDirect = calc.sections.reduce((s, sc) => s + sc.direct, 0);
  const lines: string[] = [];
  lines.push(`СНИМОК ТЕКУЩЕЙ СМЕТЫ СТУДЕНТА:`);
  lines.push(`- Название: «${lsr.title}»`);
  lines.push(`- Метод: ${lsr.method}, индексы: ${lsr.indexRegion} ${lsr.indexQuarter}`);
  lines.push(`- Позиций всего: ${totalPositions}, прямые затраты: ${formatKzt(totalDirect)}`);
  lines.push(`- НР+СП: ${formatKzt(calc.sections.reduce((s, sc) => s + sc.overhead + sc.profit, 0))}`);
  lines.push(`- Итого с НДС: ${formatKzt(calc.totalWithVat)}`);
  if (lsr.sections.length > 0) {
    lines.push(`Разделы (${lsr.sections.length}):`);
    for (const sec of lsr.sections) {
      const sc = calc.sections.find((c) => c.section.id === sec.id);
      lines.push(
        `  • [${sec.category}] «${sec.title}» — ${sec.positions.length} позиций` +
          (sc ? `, итог раздела ${formatKzt(sc.total)}` : ""),
      );
      // Top-3 позиции для краткости
      for (const p of sec.positions.slice(0, 3)) {
        const pc = sc?.positions.find((x) => x.position.id === p.id);
        lines.push(
          `    - ${p.rateCode} × ${p.volume}` +
            (pc ? ` = ${formatKzt(pc.current.direct)}` : "") +
            (p.coefficients.length > 0
              ? ` [коэф: ${p.coefficients.map((c) => c.kind).join(",")}]`
              : "") +
            (p.resourceOverrides ? " [ресурсы изменены]" : ""),
        );
      }
      if (sec.positions.length > 3) {
        lines.push(`    ... и ещё ${sec.positions.length - 3} позиций`);
      }
    }
  }
  if (notices.length > 0) {
    const errs = notices.filter((n) => n.severity === "error").length;
    const warns = notices.filter((n) => n.severity === "warning").length;
    lines.push(`AI-замечания: ${errs} ошибок, ${warns} предупреждений`);
    for (const n of notices.slice(0, 5)) {
      lines.push(`  [${n.severity}] ${n.title}: ${n.message.slice(0, 120)}`);
    }
  }
  return lines.join("\n");
}

// ── Backend call ──────────────────────────────────────────────────────

export type BackendStatus = "live" | "stub" | "offline";
export type ProviderInfo = { id: string; name: string; configured: boolean };

let cachedStatus: BackendStatus | null = null;
let cachedProviders: ProviderInfo[] | null = null;

export async function checkBackend(): Promise<{ status: BackendStatus; providers: ProviderInfo[] }> {
  try {
    const res = await fetch(`${API_BASE}/api/qcoreai/providers`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) {
      cachedStatus = "offline";
      cachedProviders = [];
      return { status: "offline", providers: [] };
    }
    const data = (await res.json()) as { providers: ProviderInfo[] };
    const anyConfigured = data.providers.some((p) => p.configured);
    cachedStatus = anyConfigured ? "live" : "stub";
    cachedProviders = data.providers;
    return { status: cachedStatus, providers: data.providers };
  } catch {
    cachedStatus = "offline";
    cachedProviders = [];
    return { status: "offline", providers: [] };
  }
}

export function getCachedStatus(): BackendStatus | null { return cachedStatus; }
export function getCachedProviders(): ProviderInfo[] | null { return cachedProviders; }

interface ChatRequestMsg { role: "system" | "user" | "assistant"; content: string; }

/** Спросить AI с учётом контекста сметы. */
export async function askLLM(
  question: string,
  history: AiMessage[],
  lsr: Lsr,
  calc: LsrCalc,
  notices: AiNotice[],
): Promise<AiMessage> {
  // Конструируем messages: system + snapshot + history (до 8 последних) + новый вопрос
  const messages: ChatRequestMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: lsrSnapshot(lsr, calc, notices) },
  ];
  for (const m of history.slice(-8)) {
    messages.push({ role: m.role, content: m.text });
  }
  messages.push({ role: "user", content: question });

  try {
    const res = await fetch(`${API_BASE}/api/qcoreai/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, temperature: 0.5 }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { mode: string; reply: string };
    // Если backend в stub-режиме (нет ключей) — fallback на локальный KB
    if (data.mode === "stub") {
      cachedStatus = "stub";
      return askConsultant(question, lsr, calc);
    }
    cachedStatus = "live";
    return {
      role: "assistant",
      text: data.reply,
      ts: Date.now(),
    };
  } catch {
    cachedStatus = "offline";
    return askConsultant(question, lsr, calc);
  }
}

// ── История чата (localStorage) ───────────────────────────────────────

export function loadChatHistory(lsrId: string): AiMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY_PREFIX + lsrId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AiMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveChatHistory(lsrId: string, messages: AiMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    // Ограничиваем до 100 последних — защита от роста
    const trimmed = messages.slice(-100);
    localStorage.setItem(HISTORY_KEY_PREFIX + lsrId, JSON.stringify(trimmed));
  } catch {}
}

export function clearChatHistory(lsrId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY_PREFIX + lsrId);
  } catch {}
}
