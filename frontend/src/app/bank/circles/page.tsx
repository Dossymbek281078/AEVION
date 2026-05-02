"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { InstallBanner } from "../_components/InstallBanner";
import { SubrouteFooter } from "../_components/SubrouteFooter";
import {
  CIRCLES_EVENT,
  loadCircles,
  type Circle,
  type CircleMessage,
} from "../_lib/circles";

type CircleStats = {
  circle: Circle;
  msgCount: number;
  sentCount: number;
  requestCount: number;
  lastActivity: number;
  totalSent: number;
  totalRequested: number;
};

function relativeTime(ts: number, lang: string): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const wk = Math.round(day / 7);
  const mo = Math.round(day / 30);
  const yr = Math.round(day / 365);
  try {
    const rtf = new Intl.RelativeTimeFormat(
      (lang as string) === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US",
      { numeric: "auto" },
    );
    if (sec < 60) return rtf.format(-sec, "second");
    if (min < 60) return rtf.format(-min, "minute");
    if (hr < 24) return rtf.format(-hr, "hour");
    if (day < 7) return rtf.format(-day, "day");
    if (wk < 5) return rtf.format(-wk, "week");
    if (mo < 12) return rtf.format(-mo, "month");
    return rtf.format(-yr, "year");
  } catch {
    return new Date(ts).toLocaleDateString();
  }
}

function statsFor(c: Circle): CircleStats {
  let sentCount = 0;
  let requestCount = 0;
  let totalSent = 0;
  let totalRequested = 0;
  let lastActivity = Date.parse(c.createdAt);
  for (const m of c.messages) {
    const ts = Date.parse(m.createdAt);
    if (Number.isFinite(ts) && ts > lastActivity) lastActivity = ts;
    if (m.kind === "sent") {
      sentCount++;
      if (typeof m.amount === "number") totalSent += m.amount;
    } else if (m.kind === "requested") {
      requestCount++;
      if (typeof m.amount === "number") totalRequested += m.amount;
    }
  }
  return {
    circle: c,
    msgCount: c.messages.length,
    sentCount,
    requestCount,
    lastActivity: Number.isFinite(lastActivity) ? lastActivity : 0,
    totalSent: Number(totalSent.toFixed(2)),
    totalRequested: Number(totalRequested.toFixed(2)),
  };
}

export default function CirclesPage() {
  const { t, lang } = useI18n();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setCircles(loadCircles());
  }, [tick]);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("storage", bump);
    window.addEventListener(CIRCLES_EVENT, bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener(CIRCLES_EVENT, bump);
    };
  }, []);

  const stats = useMemo(
    () => circles.map(statsFor).sort((a, b) => b.lastActivity - a.lastActivity),
    [circles],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stats;
    return stats.filter(
      (s) =>
        s.circle.name.toLowerCase().includes(q) ||
        s.circle.members.some((m) => m.nickname.toLowerCase().includes(q)),
    );
  }, [stats, query]);

  const totalCircles = circles.length;
  const totalMembers = useMemo(
    () => new Set(circles.flatMap((c) => c.members.map((m) => m.accountId))).size,
    [circles],
  );
  const totalMessages = useMemo(
    () => circles.reduce((s, c) => s + c.messages.length, 0),
    [circles],
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at 50% 0%, rgba(124,58,237,0.16), transparent 60%), linear-gradient(180deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        color: "#f8fafc",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link
          href="/bank"
          style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", textDecoration: "none", fontWeight: 700 }}
        >
          ← {t("about.backToBank")}
        </Link>

        <header style={{ marginTop: 18, marginBottom: 20 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#a78bfa",
              textTransform: "uppercase",
            }}
          >
            {t("circlesPage.kicker")}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1.05, marginTop: 14, marginBottom: 8 }}>
            {t("circlesPage.headline")}
          </h1>
          <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.55, maxWidth: 660 }}>
            {t("circlesPage.lede")}
          </div>
        </header>

        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            marginBottom: 18,
          }}
        >
          <Stat label={t("circlesPage.stat.circles")} value={String(totalCircles)} accent="#a78bfa" />
          <Stat label={t("circlesPage.stat.members")} value={String(totalMembers)} accent="#0ea5e9" />
          <Stat label={t("circlesPage.stat.messages")} value={String(totalMessages)} accent="#5eead4" />
        </div>

        {/* Search */}
        {circles.length > 0 && (
          <input
            type="search"
            placeholder={t("circlesPage.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("circlesPage.searchAria")}
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 10,
              background: "rgba(15,23,42,0.55)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#fff",
              fontSize: 14,
              outline: "none",
              marginBottom: 16,
            }}
          />
        )}

        {/* List */}
        {circles.length === 0 ? (
          <EmptyHero t={t} />
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 22,
              borderRadius: 14,
              background: "rgba(15,23,42,0.55)",
              border: "1px dashed rgba(255,255,255,0.18)",
              textAlign: "center",
              color: "#cbd5e1",
              marginBottom: 28,
            }}
          >
            {t("circlesPage.searchEmpty", { q: query })}
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((s) => (
              <li
                key={s.circle.id}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.55)",
                  border: "1px solid rgba(167,139,250,0.18)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "rgba(167,139,250,0.18)",
                          color: "#a78bfa",
                          fontSize: 18,
                          fontWeight: 900,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ◌
                      </span>
                      <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{s.circle.name}</div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                          {s.circle.members.length === 1
                            ? t("circlesPage.memberOne", { count: s.circle.members.length })
                            : t("circlesPage.memberMany", { count: s.circle.members.length })}
                          {" · "}
                          {t("circlesPage.lastActivity", { ago: relativeTime(s.lastActivity, lang) })}
                        </div>
                      </div>
                    </div>

                    {/* Member chips */}
                    {s.circle.members.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
                        {s.circle.members.slice(0, 6).map((m) => (
                          <span
                            key={m.accountId}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.10)",
                              fontSize: 11,
                              color: "#cbd5e1",
                            }}
                          >
                            {m.nickname}
                          </span>
                        ))}
                        {s.circle.members.length > 6 && (
                          <span style={{ padding: "3px 8px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                            +{s.circle.members.length - 6}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Mini stats */}
                    <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", fontSize: 11, color: "rgba(255,255,255,0.65)" }}>
                      <span>
                        {t("circlesPage.row.messages", { count: s.msgCount })}
                      </span>
                      {s.sentCount > 0 && (
                        <span style={{ color: "#5eead4" }}>
                          {t("circlesPage.row.sent", { count: s.sentCount, total: s.totalSent.toFixed(0) })}
                        </span>
                      )}
                      {s.requestCount > 0 && (
                        <span style={{ color: "#fbbf24" }}>
                          {t("circlesPage.row.requested", { count: s.requestCount, total: s.totalRequested.toFixed(0) })}
                        </span>
                      )}
                    </div>

                    {/* Last message preview */}
                    {s.circle.messages.length > 0 && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: 10,
                          borderRadius: 8,
                          background: "rgba(15,23,42,0.50)",
                          border: "1px solid rgba(255,255,255,0.05)",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.75)",
                          fontStyle: "italic",
                        }}
                      >
                        <span style={{ fontWeight: 700, fontStyle: "normal", color: "#a78bfa" }}>
                          {lastMessage(s.circle).authorNickname}:
                        </span>{" "}
                        {previewOf(lastMessage(s.circle))}
                      </div>
                    )}
                  </div>
                  <Link
                    href="/bank#circles"
                    style={{
                      padding: "8px 14px",
                      borderRadius: 999,
                      border: "1px solid rgba(167,139,250,0.40)",
                      color: "#a78bfa",
                      background: "rgba(167,139,250,0.08)",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      alignSelf: "center",
                    }}
                  >
                    {t("circlesPage.openIn")} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(13,148,136,0.10))",
            border: "1px solid rgba(167,139,250,0.30)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: "#a78bfa", textTransform: "uppercase" }}>
            {t("circlesPage.cta.kicker")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6, lineHeight: 1.25 }}>
            {t("circlesPage.cta.title")}
          </div>
          <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 8, lineHeight: 1.55 }}>
            {t("circlesPage.cta.body")}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <Link href="/bank" style={ctaPrimary}>
              {t("about.cta.openBank")}
            </Link>
            <Link href="/bank/contacts" style={ctaSecondary}>
              {t("circlesPage.cta.contacts")} →
            </Link>
            <Link href="/bank/about" style={ctaSecondary}>
              {t("trust.page.cta.aboutLink")}
            </Link>
          </div>
        </section>

        <div style={{ marginTop: 16 }}>
          <InstallBanner />
        </div>
        <div style={{ marginTop: 16 }}>
          <SubrouteFooter />
        </div>
      </div>
    </main>
  );
}

function lastMessage(c: Circle): CircleMessage {
  return c.messages[c.messages.length - 1];
}

function previewOf(m: CircleMessage): string {
  if (m.kind === "sent") return m.text || `→ ${m.amount} AEC`;
  if (m.kind === "requested") return m.text || `← ${m.amount} AEC`;
  return m.text;
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: "rgba(15,23,42,0.55)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 800, textTransform: "uppercase", color: accent }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function EmptyHero({ t }: { t: (k: string, v?: Record<string, string | number>) => string }) {
  return (
    <div
      style={{
        padding: 32,
        borderRadius: 18,
        background: "rgba(15,23,42,0.55)",
        border: "1px dashed rgba(167,139,250,0.30)",
        textAlign: "center",
        color: "#cbd5e1",
        marginBottom: 28,
      }}
    >
      <div aria-hidden style={{ fontSize: 48, color: "#a78bfa", marginBottom: 12, lineHeight: 1 }}>
        ◌
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
        {t("circlesPage.empty.title")}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
        {t("circlesPage.empty.body")}
      </div>
      <div style={{ marginTop: 16 }}>
        <Link href="/bank#circles" style={ctaPrimary}>
          {t("circlesPage.empty.cta")}
        </Link>
      </div>
    </div>
  );
}

const ctaPrimary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  background: "linear-gradient(135deg, #7c3aed, #0d9488)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-block",
};

const ctaSecondary: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
};
