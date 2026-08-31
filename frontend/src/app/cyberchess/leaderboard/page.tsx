"use client";
/**
 * /cyberchess/leaderboard — рейтинговый лидерборд онлайн-матчей по 4 скоростям.
 *
 * Читает GET /api-backend/api/cyberchess/matchmaking/leaderboard?speed=<s>.
 * Данные из персистентного Glicko-2 стора (переживают редеплой). Провизорные
 * рейтинги (RD>110, мало партий) помечаются «?», как у lichess.
 *
 * Визуально — на токенах .planet-* (frontend/src/app/globals.css), извлечённых
 * из explore/page.tsx — единого места в монорепо с настоящим «полугазетным»
 * стилем планеты. Раньше страница жила на generic dark slate/indigo палитре,
 * не связанной ни с чем остальным на сайте (launch-readiness аудит 2026-07-20).
 */

import { knownUserId } from "../tournaments/playerIdentity";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SPEEDS = [
  { id: "bullet", label: "Пуля" },
  { id: "blitz", label: "Блиц" },
  { id: "rapid", label: "Рапид" },
  { id: "classical", label: "Классика" },
] as const;

type SpeedId = (typeof SPEEDS)[number]["id"];

interface Row {
  rank: number;
  userId: string;
  displayName: string | null;
  rating: number;
  rd: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number;
}

interface WalletRow {
  rank: number;
  userId: string;
  displayName: string | null;
  balance: number;
  earnedTotal: number;
}

const RANK_DOT: Record<number, string> = { 1: "#c79236", 2: "#9aa5a2", 3: "#a9765a" };

function RankCell({ rank }: { rank: number }) {
  const color = RANK_DOT[rank];
  return (
    <span className="planet-num" style={{ fontWeight: 700, color: "var(--pl-muted)" }}>
      {color && <span className="planet-rank-dot" style={{ background: color }} />}
      {rank}
    </span>
  );
}

export default function CyberChessLeaderboardPage() {
  const [view, setView] = useState<"rating" | "chessy">("rating");
  const [speed, setSpeed] = useState<SpeedId>("blitz");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string>("");
  // Chessy leaderboard — server-authoritative wallet (see #671), currently
  // credited only from real matchmaking games (finalizeMatch), NOT the
  // client-side/localStorage Chessy used by puzzles/lessons/cosmetics.
  const [walletRows, setWalletRows] = useState<WalletRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setMyUserId(knownUserId());
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async (sp: SpeedId) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api-backend/api/cyberchess/matchmaking/leaderboard?speed=${sp}&limit=100`,
        { cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      const data = await r.json();
      if (!data?.ok) throw new Error("bad response");
      setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      setError("Не удалось загрузить таблицу лидеров. Попробуйте позже.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(speed);
  }, [speed, load]);

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const r = await fetch(
        `/api-backend/api/cyberchess/matchmaking/wallet/leaderboard?limit=100`,
        { cache: "no-store", signal: AbortSignal.timeout(10_000) },
      );
      const data = await r.json();
      if (!data?.ok) throw new Error("bad response");
      setWalletRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      setWalletError("Не удалось загрузить таблицу лидеров. Попробуйте позже.");
      setWalletRows([]);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "chessy" && walletRows.length === 0 && walletLoading) loadWallet();
  }, [view, walletRows.length, walletLoading, loadWallet]);

  return (
    <div className="planet-root">
      <div className="planet-wrap" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="planet-eyebrow" style={{ marginBottom: 6 }}>
              {view === "rating" ? "Рейтинг · онлайн-матчи" : "Монеты за онлайн-матчи"}
            </div>
            <h1 className="planet-h1">{view === "rating" ? "Таблица лидеров по рейтингу" : "Таблица лидеров по монетам"}</h1>
            <p className="planet-muted" style={{ marginTop: 6, fontSize: 13.5, maxWidth: "60ch" }}>
              {view === "rating"
                ? "Топ игроков онлайн-матчей. Рейтинг считается по системе Glicko-2. Неточные рейтинги (сыграно мало партий) помечены «?»."
                : "Топ игроков по заработанным в реальных матчах Chessy — не подделываемый через devtools."}
            </p>
          </div>
          <Link href="/cyberchess" className="planet-btn">← к шахматам</Link>
        </div>

        {/* Rating vs Chessy view toggle */}
        <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setView("rating")} className={`planet-btn${view === "rating" ? " active" : ""}`}>
            Рейтинг
          </button>
          <button onClick={() => setView("chessy")} className={`planet-btn${view === "chessy" ? " active" : ""}`}>
            Chessy
          </button>
        </div>

        {view === "rating" && (
          <>
            {/* Speed tabs */}
            <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SPEEDS.map((s) => (
                <button key={s.id} onClick={() => setSpeed(s.id)} className={`planet-btn${speed === s.id ? " active" : ""}`}>
                  {s.label}
                </button>
              ))}
            </div>

            <div className="planet-card" style={{ overflow: "hidden" }}>
              {loading ? (
                <div className="planet-empty">Загрузка…</div>
              ) : error ? (
                <div className="planet-empty" style={{ color: "var(--pl-danger)" }}>{error}</div>
              ) : rows.length === 0 ? (
                <div className="planet-empty">
                  Пока нет рейтинговых партий в этой скорости.
                  <br />
                  <Link href="/cyberchess/matchmaking" style={{ marginTop: 8, display: "inline-block", color: "var(--pl-gold)" }}>
                    Сыграть первым →
                  </Link>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="planet-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Игрок</th>
                        <th style={{ textAlign: "right" }}>Рейтинг</th>
                        <th style={{ textAlign: "right" }}>Партий</th>
                        <th style={{ textAlign: "right" }} className="planet-hide-sm">В/П/Н</th>
                        <th style={{ textAlign: "right" }} className="planet-hide-sm">Пик</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const isMe = row.userId === myUserId && !!myUserId;
                        const provisional = row.rd > 110;
                        return (
                          <tr key={row.userId} className={isMe ? "me" : undefined}>
                            <td><RankCell rank={row.rank} /></td>
                            <td style={{ fontWeight: 600 }}>
                              {row.displayName || "Игрок"}
                              {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--pl-gold)" }}>(вы)</span>}
                            </td>
                            <td className="planet-num" style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--pl-mono)" }}>
                              {row.rating}
                              {provisional && <span className="planet-muted" title="Неточный рейтинг: сыграно мало партий">?</span>}
                            </td>
                            <td className="planet-num planet-muted" style={{ textAlign: "right" }}>{row.games}</td>
                            <td className="planet-num planet-muted planet-hide-sm" style={{ textAlign: "right" }}>
                              <span style={{ color: "var(--pl-live)" }}>{row.wins}</span>
                              {"/"}
                              <span style={{ color: "var(--pl-danger)" }}>{row.losses}</span>
                              {"/"}
                              {row.draws}
                            </td>
                            <td className="planet-num planet-muted planet-hide-sm" style={{ textAlign: "right", fontFamily: "var(--pl-mono)" }}>
                              {row.peak}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {view === "chessy" && (
          <div className="planet-card" style={{ overflow: "hidden" }}>
            <div className="planet-muted" style={{ borderBottom: "1px solid var(--pl-line)", padding: "12px 16px", fontSize: 12 }}>
              Только с реальных онлайн-матчей (не с задач, уроков и косметики) — серверный кошелёк, честный по конструкции.
            </div>
            {walletLoading ? (
              <div className="planet-empty">Загрузка…</div>
            ) : walletError ? (
              <div className="planet-empty" style={{ color: "var(--pl-danger)" }}>{walletError}</div>
            ) : walletRows.length === 0 ? (
              <div className="planet-empty">
                Пока никто не заработал Chessy в реальных матчах.
                <br />
                <Link href="/cyberchess/matchmaking" style={{ marginTop: 8, display: "inline-block", color: "var(--pl-gold)" }}>
                  Сыграть первым →
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="planet-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Игрок</th>
                      <th style={{ textAlign: "right" }}>Баланс</th>
                      <th style={{ textAlign: "right" }} className="planet-hide-sm">Заработано всего</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletRows.map((row) => {
                      const isMe = row.userId === myUserId && !!myUserId;
                      return (
                        <tr key={row.userId} className={isMe ? "me" : undefined}>
                          <td><RankCell rank={row.rank} /></td>
                          <td style={{ fontWeight: 600 }}>
                            {row.displayName || "Игрок"}
                            {isMe && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--pl-gold)" }}>(вы)</span>}
                          </td>
                          <td className="planet-num" style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--pl-mono)", color: "var(--pl-gold)" }}>
                            {row.balance}
                          </td>
                          <td className="planet-num planet-muted planet-hide-sm" style={{ textAlign: "right", fontFamily: "var(--pl-mono)" }}>
                            {row.earnedTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
