"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/apiBase";
import { getAuthHeaders, getAuthToken } from "@/lib/auth";
import { tNav, useNavLang, type NavKey } from "./navI18n";
import { useСсылкаАвторизацииШапки } from "@/app/auth/loginHref";

type Step = {
  id: string;
  /** Ключ ярлыка в словаре navI18n.ts (ru/en/kk) — 20.10.2026, раньше английский литерал. */
  label: NavKey;
  href: string;
};

const PIPELINE_STEPS: Step[] = [
  { id: "auth", label: "auth", href: "/auth" },
  { id: "qright", label: "qright", href: "/qright" },
  { id: "qsign", label: "qsign", href: "/qsign" },
  { id: "qshield", label: "shield", href: "/quantum-shield" },
  { id: "bureau", label: "bureau", href: "/bureau" },
  { id: "planet", label: "planet", href: "/planet" },
];

type Сделано = { auth: boolean; qright: boolean };
const НИЧЕГО: Сделано = { auth: false, qright: false };

/** Один запрос на загрузку страницы (по токену): степпер стоит на 5 страницах, но не плодит запросы. */
let кэш: { токен: string; обещание: Promise<Сделано> } | null = null;

function узнатьСделанное(токен: string): Promise<Сделано> {
  if (кэш && кэш.токен === токен) return кэш.обещание;
  const обещание = (async (): Promise<Сделано> => {
    try {
      const r = await fetch(apiUrl("/api/qright/objects?mine=1"), { headers: getAuthHeaders() });
      if (r.status === 401) return НИЧЕГО; // токен протух — не вошёл
      if (!r.ok) {
        console.warn("PipelineSteps: /api/qright/objects?mine=1 ->", r.status);
        return { auth: true, qright: false };
      }
      const data = await r.json();
      return { auth: true, qright: Array.isArray(data?.items) && data.items.length > 0 };
    } catch (e) {
      console.warn("PipelineSteps: проверка своих объектов QRight не удалась", e);
      return { auth: true, qright: false };
    }
  })();
  кэш = { токен, обещание };
  return обещание;
}

/**
 * Горизонтальный степпер IP-конвейера.
 * `current` — id текущего шага (подсвечивается).
 * ✓ только у реально пройденного ЭТИМ посетителем шага (2.11.2026: раньше — у всех слева от current,
 * даже у гостя). auth — вошёл; qright — вошёл и есть ≥1 свой объект. Остальные шаги надёжного
 * признака на человека не имеют — всегда номер. Сначала рисуем номера, ✓ — после ответа (без сдвига).
 */
export function PipelineSteps({ current }: { current: string }) {
  const lang = useNavLang();
  const [сделано, setСделано] = useState<Сделано>(НИЧЕГО);
  useEffect(() => {
    const токен = getAuthToken();
    if (!токен) return;
    let жив = true;
    узнатьСделанное(токен).then((р) => { if (жив) setСделано(р); });
    return () => { жив = false; };
  }, []);
  // 2.11.2026: шаг «Авторизация» вёл на голый /auth — вход терял страницу и метку канала ?c=.
  const ссылкаАвторизации = useСсылкаАвторизацииШапки();

  const готов = (k: number): boolean => {
    const id = PIPELINE_STEPS[k]?.id;
    if (!id || id === current) return false;
    return id === "auth" ? сделано.auth : id === "qright" ? сделано.qright : false;
  };

  return (
    <div
      data-aevion-pipeline=""
      // Ярлыки уже на языке посетителя (словарь); машинный доводчик AutoTranslate их не трогает —
      // иначе на kk он переписывал «Планета» обратно в «Planet» (замер 20.10 локально).
      translate="no"
      aria-label={tNav(lang, "ariaPipeline")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 20,
        overflowX: "auto",
        padding: "2px 0",
      }}
    >
      {PIPELINE_STEPS.map((step, i) => {
        const isActive = step.id === current;
        const isDone = готов(i);
        const bg = isActive
          ? "#0f172a"
          : isDone
            ? "#0d9488"
            : "rgba(15,23,42,0.06)";
        const color = isActive || isDone ? "#fff" : "#64748b";
        const borderColor = isActive
          ? "#0f172a"
          : isDone
            ? "#0d9488"
            : "rgba(15,23,42,0.15)";

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center" }}>
            <Link
              href={step.id === "auth" ? ссылкаАвторизации : step.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                borderRadius: 999,
                background: bg,
                color,
                border: `1.5px solid ${borderColor}`,
                textDecoration: "none",
                fontWeight: isActive ? 900 : 700,
                fontSize: 12,
                whiteSpace: "nowrap",
                transition: "all 0.2s",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  background: isActive
                    ? "rgba(255,255,255,0.2)"
                    : isDone
                      ? "rgba(255,255,255,0.25)"
                      : "rgba(15,23,42,0.08)",
                  color: isActive || isDone ? "#fff" : "#94a3b8",
                  flexShrink: 0,
                }}
              >
                {isDone ? "✓" : i + 1}
              </span>
              {tNav(lang, step.label)}
            </Link>
            {i < PIPELINE_STEPS.length - 1 ? (
              <div
                style={{
                  width: 20,
                  height: 2,
                  background: isDone && готов(i + 1) ? "#0d9488" : "rgba(15,23,42,0.12)",
                  flexShrink: 0,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
