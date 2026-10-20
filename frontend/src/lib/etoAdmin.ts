"use client";

/**
 * Посетитель — админ AEVION? Роль берётся из токена входа (бэк кладёт её в JWT при
 * выпуске, signToken в routes/auth.ts). Это НЕ защита: решает только, что рисовать.
 * Всё, что требует прав, проверяет бэк по подписи токена.
 *
 * Повод — 20.10.2026, слово Оркестратора: плашка цели выручки «$1M: 0.00% · 73d»
 * видна посетителю на /multichat-engine и других оболочках; это внутренняя
 * отчётность, посетителю её показывать незачем.
 */
import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";

export function рольИзТокена(token: string | null | undefined): string | null {
  try {
    const часть = token?.split(".")[1];
    if (!часть) return null;
    const b64 = часть.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "=")));
    return typeof json?.role === "string" ? json.role : null;
  } catch {
    // Испорченный токен — не админ; это не отказ, о котором надо кричать.
    return null;
  }
}

/** false на сервере и до монтирования: плашка не мелькает у посетителя при гидрации. */
export function useЭтоАдмин(): boolean {
  const [админ, setАдмин] = useState(false);
  useEffect(() => {
    setАдмин(рольИзТокена(getAuthToken()) === "admin");
  }, []);
  return админ;
}
