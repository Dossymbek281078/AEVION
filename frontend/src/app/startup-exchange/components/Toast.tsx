"use client";

import { useEffect } from "react";

/**
 * Одно всплывающее сообщение на весь модуль.
 *
 * Копий было две, и вторая (на странице заявки) снимала себя по
 * `onAnimationEnd` — при том, что никакой анимации у неё не было. То есть
 * «Предложение отправлено основателю» висело на экране до перехода на другую
 * страницу. Замерено живым кликом 27.07.2026: отправил отклик — сообщение
 * осталось насовсем.
 */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        // Правый нижний угол занят баннером установки приложения, и сообщение
        // пряталось за ним. Центр снизу свободен на всех страницах модуля.
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0f172a",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: 10,
        boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
        fontSize: 13,
        fontWeight: 600,
        zIndex: 1100,
        maxWidth: "min(360px, calc(100vw - 32px))",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
