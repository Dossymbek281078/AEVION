"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

/**
 * Готовность модуля рядом с ценой.
 *
 * В каталоге цен QVenture помечен `availability: "beta"`, и страница цен это
 * поле показывает. Витрина и страница модуля — нет: покупатель видел цену
 * и ничего о зрелости. Две наши собственные поверхности говорят о
 * готовности разное, и человек видит ту, где сказано меньше.
 *
 * Значение берётся из /api/pricing — того же источника, что и цена. Зашивать
 * слово «бета» в разметку нельзя: снимут пометку в каталоге, а страница
 * продолжит её показывать, и мы получим ту же ложь с другой стороны.
 *
 * Ценник рядом тянет ТУ ЖЕ ручку и держит свой кэш — на странице выходит два
 * запроса вместо одного. Это осознанная цена: кэш ценника не экспортирован, а
 * его файл правят 17 ветвей и от него зависят 40 страниц. Свой кэш я завёл и
 * ОТКАТИЛ: состояние на уровне модуля живёт всю сессию, связывает тесты между
 * собой и не обновляется после отказа. Один лишний GET дешевле обоих.
 *
 * Если ручка не ответила — не показываем НИЧЕГО. Молчание здесь честнее
 * догадки: «не знаю» не должно выглядеть как «готово».
 */

const PODPIS: Record<string, string> = {
  beta: "Бета: модуль работает, но дорабатывается",
  alpha: "Ранняя версия: возможны изменения",
  planned: "В планах: пока недоступен",
};

export default function ModuleStatusNote({ moduleId }: { moduleId: string }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let otmenen = false;
    fetch(apiUrl("/api/pricing"))
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (otmenen || !j || !Array.isArray(j.modules)) return;
        const m = j.modules.find((x: { id?: string }) => x?.id === moduleId);
        const a = typeof m?.availability === "string" ? m.availability : null;
        setStatus(a && a !== "live" ? a : null);
      })
      .catch(() => {});
    return () => {
      otmenen = true;
    };
  }, [moduleId]);

  if (!status) return null;
  const text = PODPIS[status] ?? `Состояние: ${status}`;

  return (
    <span
      data-testid="module-status"
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        background: "var(--paper-2, #efeee8)",
        color: "var(--ink-soft, #45474c)",
        border: "1px solid var(--rule-mid, #b9b8b0)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {text}
    </span>
  );
}
