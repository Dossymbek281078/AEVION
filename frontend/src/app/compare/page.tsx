"use client";

/**
 * DevHub against the AI builders it gets compared to.
 *
 * The rule this page is built on: every cell shows where its claim comes from.
 * Our own numbers carry the date of the run that produced them; competitor
 * numbers carry the date they were read off public pricing and docs; anything
 * we have not measured stays blank rather than becoming a confident dash.
 *
 * It exists because a comparison table is the easiest place in a product to
 * lie by accident — and the first thing an investor or a journalist checks.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { indexCapabilities, type Capability, type CapabilityIndex } from "@/lib/devhubCapabilities";

/** Show the section that names where we are behind. Kept as one switch on
 *  purpose: it is a positioning decision, not an engineering one. */
const SHOW_WEAKNESSES = true;

/** When the competitor column was read off public pricing pages and docs. */
const COMPETITOR_DATA_DATE = "22 июля 2026";

type Origin = "measured" | "public" | "unmeasured" | "broken";

const ORIGIN_STYLE: Record<Origin, { dot: string; label: string }> = {
  measured: { dot: "#0d9488", label: "наш прогон" },
  public: { dot: "#0369a1", label: "публичные данные" },
  unmeasured: { dot: "#cbd5e1", label: "не измеряли" },
  broken: { dot: "#dc2626", label: "сейчас не работает" },
};

type Cell = { text: string; origin: Origin };

type Row = {
  feature: string;
  aevion: Cell;
  others: Record<string, Cell>;
};

const COMPETITORS = ["Bolt.new", "Lovable", "v0", "Replit"] as const;

const ROWS: Row[] = [
  {
    feature: "Сколько стоит ИИ пользователю",
    aevion: { text: "Бесплатный флот моделей; роутинг сэкономил 99% на наших прогонах", origin: "measured" },
    others: {
      "Bolt.new": { text: "$20/мес, главная жалоба — сгорают токены", origin: "public" },
      Lovable: { text: "кредиты", origin: "public" },
      v0: { text: "$20/мес, с февраля — токены", origin: "public" },
      Replit: { text: "подписка + оплата использования", origin: "public" },
    },
  },
  {
    feature: "«Опиши идею — получи приложение»",
    aevion: { text: "102 с → 11 файлов (23.07); отдельная генерация 23 с (26.07)", origin: "measured" },
    others: {
      "Bolt.new": { text: "есть", origin: "public" },
      Lovable: { text: "есть", origin: "public" },
      v0: { text: "есть", origin: "public" },
      Replit: { text: "есть, самый автономный агент", origin: "public" },
    },
  },
  {
    feature: "Скриншот → код",
    aevion: { text: "11 с; заданный цвет попал в код точно (26.07)", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "есть, сильная сторона", origin: "public" },
      Replit: { text: "", origin: "unmeasured" },
    },
  },
  {
    feature: "Превью без деплоя",
    aevion: { text: "React и Next рендерятся в браузере", origin: "measured" },
    others: {
      "Bolt.new": { text: "сильнее: настоящий Node и npm прямо в браузере", origin: "public" },
      Lovable: { text: "есть", origin: "public" },
      v0: { text: "есть", origin: "public" },
      Replit: { text: "сильнее: полноценная среда с процессами", origin: "public" },
    },
  },
  {
    feature: "Деплой называет адрес только после проверки",
    aevion: { text: "«Live» ставится, лишь когда страница реально ответила", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "", origin: "unmeasured" },
      Replit: { text: "", origin: "unmeasured" },
    },
  },
  {
    feature: "Своя база данных проекту",
    aevion: { text: "Схема и роль на проект; изоляция проверена: соседний проект получает отказ", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "сильнее: Supabase по одному промту, с политиками доступа", origin: "public" },
      v0: { text: "Supabase", origin: "public" },
      Replit: { text: "встроенная база", origin: "public" },
    },
  },
  {
    feature: "Медиа прямо в редакторе (картинки, видео, озвучка, 3D)",
    aevion: { text: "Код и цепочки запасных провайдеров есть, но сейчас не работает: у провайдеров пустые балансы", origin: "broken" },
    others: {
      "Bolt.new": { text: "нет", origin: "public" },
      Lovable: { text: "нет", origin: "public" },
      v0: { text: "нет", origin: "public" },
      Replit: { text: "нет", origin: "public" },
    },
  },
  {
    feature: "Откат любой правки ИИ",
    aevion: { text: "Точка отката на каждую правку, история и откат импорта архива", origin: "measured" },
    others: {
      "Bolt.new": { text: "", origin: "unmeasured" },
      Lovable: { text: "", origin: "unmeasured" },
      v0: { text: "", origin: "unmeasured" },
      Replit: { text: "есть откат по чекпоинтам", origin: "public" },
    },
  },
  {
    feature: "Экосистема, шаблоны, сообщество",
    aevion: { text: "Слабее всех в этой таблице — нас пока никто не знает", origin: "measured" },
    others: {
      "Bolt.new": { text: "сильная", origin: "public" },
      Lovable: { text: "сильная", origin: "public" },
      v0: { text: "сильная", origin: "public" },
      Replit: { text: "сильнейшая", origin: "public" },
    },
  },
];

const WEAKNESSES = [
  "Нет настоящей среды исполнения в браузере: у Bolt и Replit можно поставить пакеты и запустить сервер прямо на странице, у нас — превью и деплой.",
  "Интеграция с базой слабее, чем у Lovable: у них схема и правила доступа рождаются из одного промта, у нас — схема и роль, остальное руками.",
  "Медиа-возможности сейчас мертвы из-за пустых балансов у провайдеров. Код готов, деньги — нет.",
  "Экосистема и узнаваемость — наша самая слабая позиция, и быстро это не чинится.",
];

function OriginDot({ origin }: { origin: Origin }) {
  const s = ORIGIN_STYLE[origin];
  return (
    <span
      title={s.label}
      aria-label={s.label}
      style={{
        display: "inline-block", width: 7, height: 7, borderRadius: "50%",
        background: s.dot, marginRight: 7, flexShrink: 0, verticalAlign: "middle",
      }}
    />
  );
}

function CellView({ cell }: { cell: Cell }) {
  if (!cell.text) {
    return <span style={{ color: "#94a3b8", fontSize: 12.5 }}><OriginDot origin="unmeasured" />не измеряли</span>;
  }
  return (
    <span style={{ color: cell.origin === "broken" ? "#991b1b" : "#334155", fontSize: 13, lineHeight: 1.5 }}>
      <OriginDot origin={cell.origin} />
      {cell.text}
    </span>
  );
}

export default function ComparePage() {
  const [caps, setCaps] = useState<CapabilityIndex | null>(null);
  const [capList, setCapList] = useState<Capability[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/devhub/studio/capabilities"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: Capability[] = Array.isArray(d.capabilities) ? d.capabilities : [];
        setCapList(list);
        setCaps(indexCapabilities(list));
      })
      .catch(() => {});
  }, []);

  const liveNow = capList.filter((c) => c.status === "live").length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      <Wave1Nav />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px 64px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>
          DevHub и те, с кем нас сравнивают
        </h1>
        <p style={{ fontSize: 15, color: "#475569", lineHeight: 1.6, maxWidth: 760, marginBottom: 20 }}>
          В каждой клетке видно, откуда взято утверждение. Наши цифры — из наших же
          прогонов, с датой. Данные о других — с их публичных страниц, собраны{" "}
          {COMPETITOR_DATA_DATE}. Там, где мы не измеряли, стоит «не измеряли», а не
          уверенный прочерк.
        </p>

        {/* Our own state, live — the same source the shelf uses. */}
        {capList.length > 0 && (
          <div style={{
            border: "1px solid #e2e8f0", background: "#fff", borderRadius: 12,
            padding: "12px 16px", marginBottom: 24, fontSize: 13.5, color: "#0f172a",
          }}>
            <strong>Прямо сейчас у нас работает {liveNow} из {capList.length} возможностей.</strong>{" "}
            <span style={{ color: "#64748b" }}>
              Это живая цифра с сервера, а не строка в презентации — она меняется, когда
              что-то ломается у провайдера.{" "}
              <Link href="/devhub" style={{ color: "#0d9488", fontWeight: 600 }}>Открыть DevHub →</Link>
            </span>
          </div>
        )}

        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#475569", fontWeight: 700 }}>Возможность</th>
                <th style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#0d9488", fontWeight: 800 }}>AEVION DevHub</th>
                {COMPETITORS.map((c) => (
                  <th key={c} style={{ textAlign: "left", padding: "12px 14px", fontSize: 12.5, color: "#475569", fontWeight: 700 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.feature} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 600, color: "#0f172a", minWidth: 210 }}>{row.feature}</td>
                  <td style={{ padding: "12px 14px", background: "#f0fdfa", minWidth: 260 }}><CellView cell={row.aevion} /></td>
                  {COMPETITORS.map((c) => (
                    <td key={c} style={{ padding: "12px 14px", minWidth: 200 }}><CellView cell={row.others[c]} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", margin: "12px 2px 28px", fontSize: 12.5, color: "#64748b" }}>
          {(["measured", "public", "unmeasured", "broken"] as Origin[]).map((o) => (
            <span key={o}><OriginDot origin={o} />{ORIGIN_STYLE[o].label}</span>
          ))}
        </div>

        {SHOW_WEAKNESSES && (
          <section style={{
            border: "1px solid #fecaca", background: "#fef2f2", borderRadius: 12,
            padding: "16px 18px", marginBottom: 28,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "#991b1b", marginBottom: 10 }}>
              Где мы слабее — без этого таблица не стоит ничего
            </h2>
            <ul style={{ margin: 0, paddingLeft: 18, color: "#7f1d1d", fontSize: 13.5, lineHeight: 1.7 }}>
              {WEAKNESSES.map((w) => <li key={w.slice(0, 24)}>{w}</li>)}
            </ul>
          </section>
        )}

        <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Про экономию — честно</h2>
          <p style={{ fontSize: 13.5, color: "#334155", lineHeight: 1.65, margin: 0 }}>
            Набор из семи сервисов, которые обычно собирают вручную (билдер, видео,
            музыка, озвучка, картинки, 3D, хостинг), стоит около <strong>$162 в месяц</strong>{" "}
            по их публичным ценам. Наш тариф — $149. Разница мала, и продавать её как
            главную выгоду было бы неправдой. Настоящая разница в другом: не нужно
            переносить файлы между семью сервисами, у всего один общий контекст проекта.
            Насколько это быстрее в часах — <strong>мы не мерили и потому не пишем</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}
