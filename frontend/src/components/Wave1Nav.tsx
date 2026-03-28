"use client";

import Link from "next/link";

type Props = {
  /** Скрыть ссылку Planet (например на самой странице Planet) */
  hidePlanet?: boolean;
  /** Тёмный фон (/demo hero и т.п.) */
  variant?: "light" | "dark";
};

export function Wave1Nav({ hidePlanet = false, variant = "light" }: Props) {
  const sep = variant === "dark" ? "rgba(148,163,184,0.5)" : "#cbd5e1";
  const link = variant === "dark" ? "#e2e8f0" : "#334155";
  const globus = variant === "dark" ? "#5eead4" : "#0d9488";
  const demoLink = variant === "dark" ? "#5eead4" : "#0f766e";

  return (
    <nav
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 14,
        fontSize: 13,
        alignItems: "center",
      }}
      aria-label="Волна 1 — навигация"
    >
      <Link href="/" style={{ color: globus, fontWeight: 800 }}>
        ← Globus
      </Link>
      <span style={{ color: sep }} aria-hidden>
        |
      </span>
      <Link href="/demo" style={{ color: demoLink, fontWeight: 800 }}>
        Демо
      </Link>
      <span style={{ color: sep }} aria-hidden>
        |
      </span>
      <Link href="/demo/deep" style={{ color: link, fontWeight: 650 }}>
        Углублённо
      </Link>
      <span style={{ color: sep }} aria-hidden>
        |
      </span>
      <Link href="/auth" style={{ color: link, fontWeight: 600 }}>
        Auth
      </Link>
      <Link href="/qright" style={{ color: link, fontWeight: 600 }}>
        QRight
      </Link>
      <Link href="/qsign" style={{ color: link, fontWeight: 600 }}>
        QSign
      </Link>
      <Link href="/bureau" style={{ color: link, fontWeight: 600 }}>
        Bureau
      </Link>
      <span style={{ color: sep }} aria-hidden>
        |
      </span>
      <Link href="/awards/music" style={{ color: link, fontWeight: 600 }}>
        Премия · музыка
      </Link>
      <Link href="/awards/film" style={{ color: link, fontWeight: 600 }}>
        Премия · кино
      </Link>
      <Link href="/bank" style={{ color: link, fontWeight: 600 }}>
        Bank
      </Link>
      {!hidePlanet ? (
        <>
          <span style={{ color: sep }} aria-hidden>
            |
          </span>
          <Link href="/planet" style={{ color: link, fontWeight: 600 }}>
            Planet
          </Link>
        </>
      ) : null}
    </nav>
  );
}
