"use client";

// Floating goal-progress pill for full-app shells (build, qright, qsign,
// qcoreai, multichat-engine) that hide the global SiteHeader — otherwise
// those users never see New Year goal progress at all. Deliberately NOT
// rendered on /cyberchess: that surface is owned by a separate session/branch
// (see aevion-globus-backend/CLAUDE.md) and stays untouched from here.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRevenueGoal } from "@/lib/useRevenueGoal";

/**
 * Порог, ниже которого плашка не рисуется.
 *
 * Она прибита к левому верхнему углу, а в этом же углу у оболочек живёт
 * навигация. Замер сторожа вёрстки 28.08.2026 на экране 320: на /qright
 * плашка перекрыла «← Глобус» и «Демо» — кнопки стало НЕЛЬЗЯ НАЖАТЬ.
 *
 * Выбор простой: работающая навигация важнее информационной подсказки.
 * Прогресс к цели человек всё равно видит на /revenue, а вот обойти
 * перекрытую кнопку он не может никак.
 *
 * 420 берёт и 320, и 375 (обычный iPhone) — то есть телефоны целиком.
 * Двигать плашку вниз нельзя: там нижняя навигация телефона, и мы уже
 * наступали на это тремя плавающими элементами разом.
 */
const MIN_WIDTH_PX = 420;

export function AppShellRevenueBadge() {
  const { goals, summary, pct, days } = useRevenueGoal();
  // На сервере ширины нет. Начинаем со «слишком узко» и включаем плашку уже
  // в браузере: иначе на телефоне она мелькнёт поверх навигации до гидрации.
  const [wideEnough, setWideEnough] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(`(min-width: ${MIN_WIDTH_PX}px)`);
    const apply = () => setWideEnough(mq.matches);
    apply();
    // Поворот экрана меняет ширину; без подписки плашка застревает в том
    // состоянии, в котором страница открылась.
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!wideEnough) return null;
  if (!goals || !summary || pct === null || days === null) return null;

  const tip = `$${summary.grossUsd.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} собрано из $1M · ${days} дн. до срока ($20M stretch goal)`;

  return (
    <Link
      href="/revenue"
      title={tip}
      aria-label={tip}
      data-app-shell-pill="true"
      style={{
        position: "fixed",
        top: 12,
        left: 12,
        zIndex: 60,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 10px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 800,
        color: "#e2e8f0",
        background: "rgba(15,23,42,0.78)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(14,165,233,0.35)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
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
