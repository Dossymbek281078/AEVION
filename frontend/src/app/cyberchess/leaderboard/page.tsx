"use client";
/**
 * /cyberchess/leaderboard — рейтинговый лидерборд онлайн-матчей по 4 скоростям.
 *
 * Читает GET /api-backend/api/cyberchess/matchmaking/leaderboard?speed=<s>.
 * Данные из персистентного Glicko-2 стора (переживают редеплой). Провизорные
 * рейтинги (RD>110, мало партий) помечаются «?», как у lichess.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const SPEEDS = [
  { id: "bullet", label: "Пуля", icon: "💨" },
  { id: "blitz", label: "Блиц", icon: "⚡" },
  { id: "rapid", label: "Рапид", icon: "🕐" },
  { id: "classical", label: "Классика", icon: "♟" },
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
      setMyUserId(window.localStorage.getItem("cyberchess.userId") || "");
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
        { cache: "no-store" },
      );
      const data = await r.json();
      if (!data?.ok) throw new Error("bad response");
      setRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      setError("Не удалось загрузить лидерборд. Попробуйте позже.");
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
        { cache: "no-store" },
      );
      const data = await r.json();
      if (!data?.ok) throw new Error("bad response");
      setWalletRows(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch {
      setWalletError("Не удалось загрузить лидерборд. Попробуйте позже.");
      setWalletRows([]);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "chessy" && walletRows.length === 0 && walletLoading) loadWallet();
  }, [view, walletRows.length, walletLoading, loadWallet]);

  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              {view === "rating" ? "🏆 Рейтинг-лидерборд" : "💰 Chessy-лидерборд"}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {view === "rating"
                ? "Топ игроков онлайн-матчей по Glicko-2. Провизорные рейтинги (мало партий) помечены «?»."
                : "Топ игроков по заработанным в реальных матчах Chessy — серверный кошелёк, не подделываемый через devtools."}
            </p>
          </div>
          <Link
            href="/cyberchess"
            className="shrink-0 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            ← к шахматам
          </Link>
        </div>

        {/* Rating vs Chessy view toggle */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => setView("rating")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              view === "rating"
                ? "bg-slate-100 text-slate-900"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            ♟ Рейтинг
          </button>
          <button
            onClick={() => setView("chessy")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              view === "chessy"
                ? "bg-amber-500 text-slate-950"
                : "border border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            💰 Chessy
          </button>
        </div>

        {view === "rating" && (
        <>
        {/* Speed tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {SPEEDS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSpeed(s.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                speed === s.id
                  ? "bg-indigo-500 text-white"
                  : "border border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          {loading ? (
            <div className="px-4 py-16 text-center text-slate-500">Загрузка…</div>
          ) : error ? (
            <div className="px-4 py-16 text-center text-rose-400">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-16 text-center text-slate-500">
              Пока нет рейтинговых партий в этой скорости.
              <br />
              <Link href="/cyberchess/matchmaking" className="mt-2 inline-block text-indigo-400 hover:underline">
                Сыграть первым →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2.5 font-semibold">#</th>
                    <th className="px-3 py-2.5 font-semibold">Игрок</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Рейтинг</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Партий</th>
                    <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">В/П/Н</th>
                    <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Пик</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isMe = row.userId === myUserId && !!myUserId;
                    const provisional = row.rd > 110;
                    return (
                      <tr
                        key={row.userId}
                        className={`border-b border-slate-800/60 transition ${
                          isMe ? "bg-indigo-500/10" : "hover:bg-slate-800/40"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-bold text-slate-400">
                          {medal(row.rank) || row.rank}
                        </td>
                        <td className="px-3 py-2.5 font-semibold">
                          {row.displayName || "Игрок"}
                          {isMe && <span className="ml-1.5 text-xs text-indigo-400">(вы)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold">
                          {row.rating}
                          {provisional && (
                            <span title="Провизорный — мало партий" className="text-slate-500">
                              ?
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-400">{row.games}</td>
                        <td className="hidden px-3 py-2.5 text-right text-slate-400 sm:table-cell">
                          <span className="text-emerald-400">{row.wins}</span>
                          {"/"}
                          <span className="text-rose-400">{row.losses}</span>
                          {"/"}
                          <span className="text-slate-400">{row.draws}</span>
                        </td>
                        <td className="hidden px-3 py-2.5 text-right font-mono text-slate-500 sm:table-cell">
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
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-500">
              Только с реальных онлайн-матчей (не с пазлов/уроков/косметики) — серверный кошелёк, честный по конструкции.
            </div>
            {walletLoading ? (
              <div className="px-4 py-16 text-center text-slate-500">Загрузка…</div>
            ) : walletError ? (
              <div className="px-4 py-16 text-center text-rose-400">{walletError}</div>
            ) : walletRows.length === 0 ? (
              <div className="px-4 py-16 text-center text-slate-500">
                Пока никто не заработал Chessy в реальных матчах.
                <br />
                <Link href="/cyberchess/matchmaking" className="mt-2 inline-block text-indigo-400 hover:underline">
                  Сыграть первым →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 font-semibold">#</th>
                      <th className="px-3 py-2.5 font-semibold">Игрок</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Баланс</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Заработано всего</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletRows.map((row) => {
                      const isMe = row.userId === myUserId && !!myUserId;
                      return (
                        <tr
                          key={row.userId}
                          className={`border-b border-slate-800/60 transition ${
                            isMe ? "bg-amber-500/10" : "hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="px-3 py-2.5 font-bold text-slate-400">
                            {medal(row.rank) || row.rank}
                          </td>
                          <td className="px-3 py-2.5 font-semibold">
                            {row.displayName || "Игрок"}
                            {isMe && <span className="ml-1.5 text-xs text-amber-400">(вы)</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-400">
                            💰 {row.balance}
                          </td>
                          <td className="hidden px-3 py-2.5 text-right font-mono text-slate-500 sm:table-cell">
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
