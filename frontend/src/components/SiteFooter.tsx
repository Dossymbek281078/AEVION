import type { CSSProperties } from "react";
import Link from "next/link";
import { KeepChannelLink } from "./KeepChannelLink";
import { repoUrl } from "@/lib/repoUrl";

/**
 * Ссылка подвала. Раньше тот же объект стиля был вписан в каждую из двенадцати
 * ссылок; теперь он один, и вместе с ним задана минимальная площадь касания.
 *
 * Замер 31.08.2026 в браузере на экране 390px: ссылки подвала имели высоту
 * 20px при нижней границе 24px, ниже которой попасть пальцем трудно (WCAG
 * 2.5.8). Трафик воронки идёт с роликов, то есть почти весь с телефонов.
 * Шестнадцать таких ссылок в подвале и двадцать шесть в шапке; шапку правят
 * шесть чужих ветвей, поэтому здесь только подвал, а шапка передана владельцу.
 *
 * Высота задаётся минимумом, а не отступом: отступ раздвинул бы колонку и
 * изменил вид, а min-height добирает площадь касания, оставляя вид прежним.
 */
const footerLink: CSSProperties = {
  color: "#94a3b8",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};

/** Приглушённый ряд внизу: цвет другой, площадь касания та же. */
const footerLinkMuted: CSSProperties = { ...footerLink, color: "#64748b" };


export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        background: "#0f172a",
        color: "#94a3b8",
        // Нижний отступ учитывает плавающую кнопку агента: она закреплена
        // в правом нижнем углу и накрывала последнюю строку подвала
        // (замер 02.09.2026: «Помощь» -> /help недостижима на 40 адресах).
        // Задаём здесь, а не в globals.css: строчный стиль сильнее правила
        // из таблицы, и правило молча не сработало бы.
        padding: "40px 20px calc(28px + var(--aevion-agent-h, 0px))",
        fontSize: 13,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 32,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#f8fafc", marginBottom: 8, letterSpacing: "-0.02em" }}>
            AEVION
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 13, color: "#94a3b8" }}>
            Global trust infrastructure for digital content, intellectual property and creator economy.
          </p>
          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            Astana, Kazakhstan
          </div>
        </div>

        {/* Products */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Products
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <KeepChannelLink href="/qright" style={footerLink}>QRight — IP Registry</KeepChannelLink>
            <KeepChannelLink href="/qsign" style={footerLink}>QSign — Signatures</KeepChannelLink>
            <KeepChannelLink href="/bureau" style={footerLink}>IP Bureau</KeepChannelLink>
            <KeepChannelLink href="/planet" style={footerLink}>Planet Compliance</KeepChannelLink>
            <KeepChannelLink href="/awards" style={footerLink}>Awards</KeepChannelLink>
            <KeepChannelLink href="/bank" style={footerLink}>AEVION Bank</KeepChannelLink>
            <KeepChannelLink href="/cyberchess" style={footerLink}>CyberChess</KeepChannelLink>
          </div>
        </div>

        {/* Company */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Company
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <KeepChannelLink href="/demo" style={footerLink}>Demo</KeepChannelLink>
            <KeepChannelLink href="/terms" style={footerLink}>Terms of Service</KeepChannelLink>
            <KeepChannelLink href="/privacy" style={footerLink}>Privacy Policy</KeepChannelLink>
            <KeepChannelLink href="/help" style={footerLink}>Help Center</KeepChannelLink>
          </div>
        </div>

        {/* Contact */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>
            Contact
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a href="mailto:yahiin1978@gmail.com" style={footerLink}>yahiin1978@gmail.com</a>
            <span>Astana, Kazakhstan</span>
            <span>+7 702 625 83 77</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <a
              href={repoUrl()}
              target="_blank"
              rel="noreferrer"
              style={{ ...footerLinkMuted, fontWeight: 700 }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1280,
          margin: "28px auto 0",
          paddingTop: 20,
          borderTop: "1px solid rgba(148,163,184,0.15)",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <div>&copy; {year} AEVION. All rights reserved.</div>
        <div style={{ display: "flex", gap: 16 }}>
          <KeepChannelLink href="/terms" style={footerLinkMuted}>Terms</KeepChannelLink>
          <KeepChannelLink href="/privacy" style={footerLinkMuted}>Privacy</KeepChannelLink>
          <KeepChannelLink href="/help" style={footerLinkMuted}>Help</KeepChannelLink>
        </div>
      </div>
    </footer>
  );
}
