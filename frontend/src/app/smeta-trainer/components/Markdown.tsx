"use client";

import { Fragment } from "react";
import { GLOSSARY } from "../lib/glossary";

/**
 * Минимальный markdown-рендер без внешних библиотек.
 * Поддерживает: # заголовки (h1-h3), **bold**, *italic*, `inline code`,
 * списки (- / *), нумерованные списки (1. 2.), цитаты (>), блоки кода
 * (```...```), ссылки [text](url), горизонтальные разделители (---).
 *
 * Не цель — полный CommonMark. Цель — корректный рендер ответов LLM
 * по сметному делу (заголовки, списки правил, код, цитаты НПА).
 *
 * autoGloss: автоматически вставляет ссылки на глоссарий для первого вхождения
 *            каждого термина из GLOSSARY (только в plain-text, не в коде/ссылках).
 */

interface Props {
  text: string;
  /** Автолинковать термины глоссария (по умолчанию false; для уроков — true). */
  autoGloss?: boolean;
}

// Заранее построенная карта: нормализованная форма (lowercase) → канонический term для якоря
const GLOSS_LOOKUP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  GLOSSARY.forEach((g) => {
    map.set(g.term.toLowerCase(), g.term);
    g.aliases?.forEach((a) => map.set(a.toLowerCase(), g.term));
  });
  return map;
})();

// Собираем все формы (term + aliases) и сортируем по убыванию длины,
// чтобы длинные («Лимитированные затраты») матчились раньше коротких («затраты»).
const GLOSS_FORMS: string[] = (() => {
  const forms = new Set<string>();
  GLOSSARY.forEach((g) => {
    forms.add(g.term);
    g.aliases?.forEach((a) => forms.add(a));
  });
  return [...forms].sort((a, b) => b.length - a.length);
})();

const GLOSS_RE = (() => {
  if (GLOSS_FORMS.length === 0) return null;
  const escaped = GLOSS_FORMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Cyrillic-aware: ни до, ни после — не буква/цифра. Используем lookarounds.
  return new RegExp(
    `(?<![А-Яа-яA-Za-zЁё0-9])(${escaped.join("|")})(?![А-Яа-яA-Za-zЁё0-9])`,
    "g",
  );
})();

/**
 * Препроцесс: вставляет markdown-ссылки [term](/smeta-trainer/glossary#term-X)
 * для первого вхождения каждой формы термина. Уважает code-fences (```), inline `code`
 * и существующие markdown-ссылки [text](url) — внутрь них не трогает.
 */
function injectGlossaryLinks(input: string): string {
  if (!GLOSS_RE) return input;
  // 1. Разделяем текст на «защищённые» сегменты (code-block, inline-code, link)
  // и «обычные» (где можем вставлять ссылки). Регекс ловит любой защищённый сегмент.
  const PROTECT_RE = /(```[\s\S]*?```|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const out: string[] = [];
  const linked = new Set<string>(); // канонические термы, для которых уже добавили ссылку
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  PROTECT_RE.lastIndex = 0;
  while ((m = PROTECT_RE.exec(input)) !== null) {
    out.push(processPlain(input.slice(lastIdx, m.index), linked));
    out.push(m[0]); // защищённое — без изменений
    lastIdx = m.index + m[0].length;
  }
  out.push(processPlain(input.slice(lastIdx), linked));
  return out.join("");
}

function processPlain(text: string, linked: Set<string>): string {
  if (!GLOSS_RE) return text;
  GLOSS_RE.lastIndex = 0;
  return text.replace(GLOSS_RE, (match) => {
    const canonical = GLOSS_LOOKUP.get(match.toLowerCase());
    if (!canonical) return match;
    if (linked.has(canonical)) return match;
    linked.add(canonical);
    // Cyrillic in href OK для современных браузеров; encodeURI защитит пробелы.
    return `[${match}](/smeta-trainer/glossary#term-${encodeURIComponent(canonical)})`;
  });
}

export function Markdown({ text, autoGloss = false }: Props) {
  const processed = autoGloss ? injectGlossaryLinks(text) : text;
  // Сначала блочный уровень: разбиваем по строкам, группируем
  const lines = processed.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Пустая строка — пропускаем
    if (!line.trim()) { i++; continue; }

    // Блок кода ```
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]); i++;
      }
      i++; // закрывающие ```
      blocks.push(
        <pre key={key++} className="bg-slate-900 text-slate-100 rounded p-2 my-1 overflow-x-auto text-[10px] leading-snug">
          {lang && <div className="text-[9px] text-slate-500 uppercase mb-0.5">{lang}</div>}
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Горизонтальная линия
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-1.5 border-slate-200" />);
      i++; continue;
    }

    // Заголовки
    const hMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length;
      const txt = hMatch[2];
      const cls =
        level === 1 ? "text-sm font-bold mt-1.5 mb-0.5" :
        level === 2 ? "text-xs font-bold mt-1 mb-0.5" :
        "text-xs font-semibold mt-1";
      blocks.push(
        <div key={key++} className={cls}>{renderInline(txt)}</div>
      );
      i++; continue;
    }

    // Цитата
    if (/^>\s/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, "")); i++;
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-emerald-300 pl-2 my-1 text-slate-600 italic">
          {quoteLines.map((l, idx) => (
            <div key={idx}>{renderInline(l)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Нумерованный список
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, "")); i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-5 my-0.5 space-y-0.5">
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ol>
      );
      continue;
    }

    // Маркированный список
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, "")); i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-0.5 space-y-0.5">
          {items.map((it, idx) => <li key={idx}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // Обычный параграф (объединяем сплошные не-пустые строки)
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}|>|\d+\.|[-*])\s/.test(lines[i]) && !/^```/.test(lines[i])) {
      paraLines.push(lines[i]); i++;
    }
    blocks.push(
      <p key={key++} className="my-0.5">
        {paraLines.map((l, idx) => (
          <Fragment key={idx}>
            {idx > 0 && <br />}
            {renderInline(l)}
          </Fragment>
        ))}
      </p>
    );
  }

  return <div className="markdown-content space-y-0.5">{blocks}</div>;
}

// ── Inline-уровень: bold, italic, code, links ─────────────────────────

function renderInline(text: string): React.ReactNode {
  // Защищённый порядок: сначала `code` (его содержимое не парсим),
  // потом ссылки, потом **bold**, потом *italic*.
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest) {
    // `code`
    let m: RegExpMatchArray | null = rest.match(/^([\s\S]*?)`([^`]+)`/);
    if (m) {
      if (m[1]) parts.push(...inlineRich(m[1], "k0_" + key++));
      parts.push(
        <code key={"c_" + key++} className="bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-[10px] font-mono">
          {m[2]}
        </code>
      );
      rest = rest.slice(m[0].length);
      continue;
    }
    // [text](url)
    m = rest.match(/^([\s\S]*?)\[([^\]]+)\]\(([^)\s]+)\)/);
    if (m) {
      if (m[1]) parts.push(...inlineRich(m[1], "k1_" + key++));
      const href = m[3];
      const isGloss = href.startsWith("/smeta-trainer/glossary#");
      parts.push(
        <a
          key={"a_" + key++}
          href={href}
          target={isGloss ? undefined : "_blank"}
          rel={isGloss ? undefined : "noopener noreferrer"}
          className={
            isGloss
              ? "text-emerald-800 decoration-dotted decoration-emerald-400 underline underline-offset-2 hover:decoration-emerald-800"
              : "text-emerald-600 hover:text-emerald-800 underline"
          }
          title={isGloss ? "Открыть в глоссарии" : undefined}
        >
          {m[2]}
        </a>
      );
      rest = rest.slice(m[0].length);
      continue;
    }
    // Никаких code/links — обрабатываем bold + italic в остатке
    parts.push(...inlineRich(rest, "rest_" + key++));
    rest = "";
  }
  return <>{parts}</>;
}

/** **bold** + *italic* + остаток plain. */
function inlineRich(text: string, baseKey: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let m: RegExpMatchArray | null = rest.match(/^([\s\S]*?)\*\*([^*]+)\*\*/);
    if (m) {
      if (m[1]) out.push(...italicSplit(m[1], baseKey + "_" + key++));
      out.push(<strong key={baseKey + "_b" + key++} className="font-semibold">{m[2]}</strong>);
      rest = rest.slice(m[0].length);
      continue;
    }
    out.push(...italicSplit(rest, baseKey + "_" + key++));
    rest = "";
  }
  return out;
}

function italicSplit(text: string, baseKey: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    const m = rest.match(/^([\s\S]*?)\*([^*\s][^*]*[^*\s]|[^*\s])\*/);
    if (m) {
      if (m[1]) out.push(<Fragment key={baseKey + "_p" + key++}>{m[1]}</Fragment>);
      out.push(<em key={baseKey + "_i" + key++}>{m[2]}</em>);
      rest = rest.slice(m[0].length);
      continue;
    }
    out.push(<Fragment key={baseKey + "_p" + key++}>{rest}</Fragment>);
    rest = "";
  }
  return out;
}
