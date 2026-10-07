"use client";

/**
 * AEVION Awards — submission form + voting leaderboard panel.
 * Shared between /awards/music and /awards/film.
 */

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  AwardSubmission,
  AwardTrack,
  castVote,
  listSubmissions,
  readVotedIds,
  resetTrack,
} from "../_lib/submissions";

type Theme = {
  accent: string;
  accentSoft: string;
  border: string;
  cardBg: string;
  buttonBg: string;
  buttonText: string;
  formBg: string;
  formBorder: string;
};

const MUSIC_THEME: Theme = {
  accent: "#c4b5fd",
  accentSoft: "#a78bfa",
  border: "rgba(167,139,250,0.35)",
  cardBg: "linear-gradient(165deg, rgba(76,29,149,0.18), rgba(15,23,42,0.7))",
  buttonBg: "linear-gradient(135deg, #7c3aed, #4c1d95)",
  buttonText: "#fff",
  formBg: "rgba(15,23,42,0.65)",
  formBorder: "rgba(167,139,250,0.3)",
};

const FILM_THEME: Theme = {
  accent: "#fde68a",
  accentSoft: "#fbbf24",
  border: "rgba(251,191,36,0.35)",
  cardBg: "linear-gradient(165deg, rgba(180,83,9,0.18), rgba(15,23,42,0.7))",
  buttonBg: "linear-gradient(135deg, #b45309, #7f1d1d)",
  buttonText: "#fff",
  formBg: "rgba(15,23,42,0.65)",
  formBorder: "rgba(251,191,36,0.3)",
};

const MEDAL_COLORS: Record<number, { ring: string; bg: string; labelKey: string }> = {
  0: { ring: "#fde047", bg: "rgba(253,224,71,0.12)", labelKey: "awardsTrack.lb.rank1" },
  1: { ring: "#cbd5e1", bg: "rgba(203,213,225,0.10)", labelKey: "awardsTrack.lb.rank2" },
  2: { ring: "#d97706", bg: "rgba(217,119,6,0.12)", labelKey: "awardsTrack.lb.rank3" },
};

type Toast = { kind: "success" | "error"; text: string } | null;

export function AwardsTrackPanel({ track }: { track: AwardTrack }) {
  const { t } = useI18n();
  const theme = track === "music" ? MUSIC_THEME : FILM_THEME;
  const trackLabel = track === "music" ? t("awardsTrack.label.music") : t("awardsTrack.label.film");

  const [items, setItems] = useState<AwardSubmission[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Form state

  const [toast, setToast] = useState<Toast>(null);
  const [bumpId, setBumpId] = useState<string | null>(null);

  const refresh = () => {
    setItems(listSubmissions(track));
    setVoted(readVotedIds(track));
  };

  useEffect(() => {
    refresh();
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(t);
  }, [toast]);


  function handleVote(id: string) {
    const next = castVote(track, id);
    if (next === null) return;
    setBumpId(id);
    window.setTimeout(() => setBumpId(null), 600);
    refresh();
  }

  function handleReset() {
    if (!hydrated) return;
    const ok = window.confirm(t("awardsTrack.toast.resetConfirm", { label: trackLabel.toLowerCase() }));
    if (!ok) return;
    resetTrack(track);
    refresh();
    setToast({ kind: "success", text: t("awardsTrack.toast.resetDone", { label: trackLabel.toLowerCase() }) });
  }


  return (
    <div
      style={{
        background: "#020617",
        color: "#e2e8f0",
        padding: "16px 24px 56px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* ─── Section: Submit form ─────────────────────────── */}
        <section
          style={{
            marginTop: 16,
            padding: 24,
            borderRadius: 18,
            border: `1px solid ${theme.formBorder}`,
            background: theme.cardBg,
          }}
          aria-labelledby={`submit-${track}-heading`}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.2em",
              color: theme.accent,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {t("awardsTrack.form.kicker.before")}{trackLabel}
          </div>
          <h2
            id={`submit-${track}-heading`}
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#f8fafc",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}
          >
            {t("awardsTrack.form.h2.before")}{trackLabel.toLowerCase()}{t("awardsTrack.form.h2.after")}
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              color: "#cbd5e1",
              lineHeight: 1.55,
            }}
          >
            {t("awardsTrack.form.intro")}
          </p>

          {/* 06.10.2026. Здесь стояла ФОРМА, которая никуда не отправляла.
              Замер прода: под её заголовком шла строка «Demo mode — backend
              submission endpoint coming in next sprint. Entries are saved to
              your browser only», а ниже — обещание выплат «1st = 500 AEC,
              2nd = 250, 3rd = 100 в ваш кошелёк AEVION Bank». Человек заполнял
              пять полей, жал «Submit work» и его работа оставалась у него в
              браузере. При этом РАБОЧАЯ дверь существует и на неё ведёт сам
              хаб /awards — та же, что стоит ниже. Две двери рядом, и попасть
              в тупиковую было вероятнее.
              Формы больше нет: кнопка ведёт туда, где заявку действительно
              принимают. */}
          <a
            href={ПУТЬ_ПОДАЧИ[track]}
            style={{
              display: "inline-block",
              padding: "13px 22px",
              borderRadius: 12,
              border: "none",
              background: theme.accent,
              color: "#0b1120",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: "0.02em",
              textDecoration: "none",
              boxShadow: `0 8px 28px ${theme.border}`,
            }}
          >
            {t("awardsTrack.form.submit")}
          </a>

          {toast ? (
            <div
              role="status"
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                background:
                  toast.kind === "success"
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(239,68,68,0.15)",
                border:
                  toast.kind === "success"
                    ? "1px solid rgba(16,185,129,0.45)"
                    : "1px solid rgba(239,68,68,0.45)",
                color: toast.kind === "success" ? "#6ee7b7" : "#fca5a5",
              }}
            >
              {toast.text}
            </div>
          ) : null}
        </section>

        {/* 06.10.2026. Здесь рисовался блок «AEC payout»: «1st = 500 AEC,
            2nd = 250, 3rd = 100, settled to your AEVION Bank wallet».
            Замер по коду: AEC_PAYOUTS — константы ФРОНТА в модуле локального
            хранилища (_lib/submissions.ts), и ни одна строка бэкенда не
            начисляет AEC победителю премии. Механизм начисления существует
            (internalMintForDevice в routes/aev.ts), но зовут его из ровно
            ОДНОГО места — routes/bureau.ts:1160, награда за сертификат бюро;
            слова «award» в обоих файлах ноль. Победителя к тому же нечем
            определить: distinctVotersAllTime = 0 за всё время.
            Решение оркестратора от 06.10: блок снять со всех страниц премий,
            пока начисление не связано с премиями. Константу НЕ удаляем —
            просто не рисуем, чтобы вернуть блок одним движением, когда
            механизм появится. */}

        {/* ─── Section: Leaderboard ──────────────────────────── */}
        <section style={{ marginTop: 28 }} aria-labelledby={`board-${track}-heading`}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <h2
              id={`board-${track}-heading`}
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 900,
                color: "#f8fafc",
                letterSpacing: "-0.02em",
              }}
            >
              {t("awardsTrack.lb.h2")}
            </h2>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {t("awardsTrack.lb.totalSorted", { n: items.length })}
            </div>
          </div>

          {hydrated && items.length === 0 ? (
            <div
              style={{
                padding: 28,
                borderRadius: 14,
                border: "1px dashed rgba(148,163,184,0.35)",
                background: "rgba(15,23,42,0.5)",
                color: "#94a3b8",
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {t("awardsTrack.lb.empty")}
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {items.map((sub, i) => {
              const medal = MEDAL_COLORS[i];
              const alreadyVoted = voted.has(sub.id);
              const isBumping = bumpId === sub.id;
              return (
                <article
                  key={sub.id}
                  style={{
                    position: "relative",
                    padding: 18,
                    borderRadius: 16,
                    border: medal
                      ? `1px solid ${medal.ring}`
                      : `1px solid ${theme.border}`,
                    background: medal
                      ? `linear-gradient(165deg, ${medal.bg}, rgba(15,23,42,0.7))`
                      : theme.cardBg,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {medal ? (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        fontSize: 10,
                        fontWeight: 900,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: medal.bg,
                        color: medal.ring,
                        border: `1px solid ${medal.ring}`,
                      }}
                    >
                      {t(medal.labelKey)}
                    </div>
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#94a3b8",
                      }}
                    >
                      #{i + 1}
                    </div>
                  )}

                  <h3
                    style={{
                      margin: 0,
                      fontSize: 17,
                      fontWeight: 800,
                      color: "#f8fafc",
                      letterSpacing: "-0.01em",
                      paddingRight: 80,
                    }}
                  >
                    {sub.title}
                  </h3>
                  <div style={{ fontSize: 13, color: theme.accent, fontWeight: 700 }}>
                    {sub.author}
                  </div>
                  {sub.description ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: "#cbd5e1",
                        lineHeight: 1.5,
                      }}
                    >
                      {sub.description}
                    </p>
                  ) : null}

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(148,163,184,0.15)",
                        color: "#cbd5e1",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {sub.year}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: `${theme.border}`,
                        color: theme.accent,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {sub.genre}
                    </span>
                    {sub.seeded ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "rgba(94,234,212,0.12)",
                          color: "#5eead4",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {t("awardsTrack.lb.demoSeed")}
                      </span>
                    ) : null}
                  </div>

                  <a
                    href={sub.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12,
                      color: "#7dd3fc",
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    {sub.mediaUrl}
                  </a>

                  <div
                    style={{
                      marginTop: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      paddingTop: 10,
                      borderTop: "1px solid rgba(148,163,184,0.18)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        color: "#f8fafc",
                        letterSpacing: "-0.02em",
                        transform: isBumping ? "scale(1.18)" : "scale(1)",
                        transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      {sub.votes}
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {t("awardsTrack.lb.votes")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleVote(sub.id)}
                      disabled={alreadyVoted}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: "none",
                        cursor: alreadyVoted ? "default" : "pointer",
                        background: alreadyVoted
                          ? "rgba(148,163,184,0.18)"
                          : theme.buttonBg,
                        color: alreadyVoted ? "#94a3b8" : theme.buttonText,
                        fontWeight: 800,
                        fontSize: 13,
                        opacity: alreadyVoted ? 0.7 : 1,
                      }}
                    >
                      {alreadyVoted ? t("awardsTrack.lb.voted") : t("awardsTrack.lb.vote")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div style={{ marginTop: 18, textAlign: "right" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.05em",
                cursor: "pointer",
                textDecoration: "underline",
                padding: 0,
              }}
            >
              {t("awardsTrack.lb.reset")}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Local UI bits ─────────────────────────────────────────── */

/**
 * Единственная РАБОЧАЯ дверь подачи. Адреса взяты не из головы: ровно эти две
 * ссылки стоят на хабе `/awards` (frontend/src/app/awards/page.tsx), и именно
 * они отвечают 200 без оговорки «demo» — проверено на проде 06.10.2026.
 * Держать их здесь копией приходится потому, что панель не получает их пропсом;
 * если адреса на хабе изменятся, сторож awardsSubmitDoorIsReal.guard.test.ts
 * покраснеет — он сверяет обе стороны.
 */
const ПУТЬ_ПОДАЧИ: Record<"music" | "film", string> = {
  music: "/planet?type=music&preset=music&productKey=aevion_award_music_v1&title=AEVION%20Music%20Awards%20Submission",
  film: "/planet?type=movie&preset=film&productKey=aevion_award_film_v1&title=AEVION%20Film%20Awards%20Submission",
};

// Компонент Field (подпись + поле ввода) удалён 06.10.2026 вместе с демо-формой
// подачи: он больше ничем не вызывается. Оставлять его значило бы держать след
// удалённого — код, который выглядит живым и не делает ничего.

function inputStyle(theme: Theme): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.3)",
    background: theme.formBg,
    color: "#f8fafc",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
  };
}
