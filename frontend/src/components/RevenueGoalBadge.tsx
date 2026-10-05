"use client";

// Compact cross-module goal-progress pill for the global header. Reads the
// same two endpoints /revenue itself uses (goals + summary) so the $1M/$20M
// New Year targets stay visible from any module, not just the dashboard.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRevenueGoal } from "@/lib/useRevenueGoal";
import { useI18nOptional } from "@/lib/i18n";
import { revenueTip } from "@/lib/revenueTip";
import { скрытьЗначокПрогресса } from "@/lib/revenueBadgeHidden";

export default function RevenueGoalBadge() {
  const { goals, summary, pct, days } = useRevenueGoal();
  const lang = useI18nOptional()?.lang ?? "ru";
  // usePathname() возвращает null вне контекста маршрутизации (так бывает в тестах
  // и на некоторых серверных путях). Без запаса значок падал и РОНЯЛ ВСЮ ШАПКУ —
  // поймано своим же прогоном: чужой тест keepChannelLink покраснел с
  // «Cannot read properties of null». Пустая строка здесь значит «путь неизвестен»,
  // и тогда ведём себя как раньше: значок показываем.
  const путь = usePathname() ?? "";

  /*
   * 🔴 НА /bureau ЗНАЧОК НЕ ПОКАЗЫВАЕМ. Замер окна 2b 02.10.2026: письма к
   * лабораториям ИИ ведут на /bureau, и получатель первым видит «🎯 $1M: 0.00%».
   * Для покупателя данных это читается однозначно — «у них ничего не продаётся», —
   * и дальше он не читает. Значок полезен нам внутри: он честно показывает путь к
   * цели. Но страница, на которую приходит покупатель по личному письму, не место
   * для нашей внутренней отчётности.
   *
   * Прячем ровно здесь, а не правим сам значок и не трогаем остальные страницы:
   * /revenue, главная и витрины показывают его как раньше.
   */
  if (скрытьЗначокПрогресса(путь)) return null;

  if (!goals || !summary || pct === null || days === null) return null;

  // Строка — из общего revenueTip: двойник в AppShellRevenueBadge уже начал
  // расходиться с этой копией, и доводчик атрибуты не переводит (06.09.2026).
  const tip = revenueTip(lang, summary.grossUsd, days);

  return (
    <Link
      href="/revenue"
      title={tip}
      aria-label={tip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        color: "#0c4a6e",
        background: "rgba(14,165,233,0.12)",
        border: "1px solid rgba(14,165,233,0.35)",
        textDecoration: "none",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>🎯</span>
      $1M: {pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2)}%
      <span style={{ fontWeight: 600, opacity: 0.75 }}>· {days}d</span>
    </Link>
  );
}
