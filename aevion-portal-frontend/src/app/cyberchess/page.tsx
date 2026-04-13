"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Link from "next/link";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4001";

type CyberPlayer = {
  id: string;
  name: string;
  createdAt: string;
};

type CyberMove = {
  id: string;
  gameId: string;
  ply: number;
  san: string | null;
  uci: string | null;
  fenAfter: string | null;
  createdAt: string;
};

type CyberGame = {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  fen: string;
  status: string;
  createdAt: string;
  moves?: CyberMove[];
};

export default function CyberChessPage() {
  const [players, setPlayers] = useState<CyberPlayer[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [playersErr, setPlayersErr] = useState<string | null>(null);

  const [newPlayerName, setNewPlayerName] = useState("");

  const [whiteId, setWhiteId] = useState("");
  const [blackId, setBlackId] = useState("");

  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<CyberGame | null>(null);
  const [moves, setMoves] = useState<CyberMove[]>([]);
  const [loadingGame, setLoadingGame] = useState(false);
  const [gameErr, setGameErr] = useState<string | null>(null);

  const [uciMove, setUciMove] = useState("e2e4");
  const [addingMove, setAddingMove] = useState(false);

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);

  const lastMove = useMemo(() => {
    return moves.length ? moves[moves.length - 1] : null;
  }, [moves]);

  const lastFromTo = useMemo(() => {
    const uci = lastMove?.uci || null;
    if (!uci || uci.length < 4) return null;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    return { from, to };
  }, [lastMove]);

  const fenBoard = useMemo(() => {
    const fen = game?.fen || "";
    const placement = fen.split(" ")[0] || "";
    if (!placement) return null;

    const ranks = placement.split("/");
    if (ranks.length !== 8) return null;

    const board: Array<Array<string | null>> = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => null)
    );

    for (let r = 0; r < 8; r++) {
      const rank = ranks[r] || "";
      let c = 0;
      for (let i = 0; i < rank.length; i++) {
        const ch = rank[i];
        if (ch >= "1" && ch <= "8") {
          const n = Number(ch);
          for (let k = 0; k < n; k++) {
            board[r][c] = null;
            c++;
          }
          continue;
        }

        if (c < 8) {
          board[r][c] = ch;
          c++;
        }
      }
    }

    const activeColor = (fen.split(" ")[1] || "w") === "b" ? "b" : "w";
    return { board, activeColor };
  }, [game?.fen]);

  const chessForLegal = useMemo(() => {
    if (!game?.fen) return null;
    try {
      return new Chess(game.fen);
    } catch {
      return null;
    }
  }, [game?.fen]);

  const legalMoves = useMemo(() => {
    if (!chessForLegal) return [];
    return chessForLegal.moves({ verbose: true }) as any[];
  }, [chessForLegal]);

  const legalToByFrom = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of legalMoves) {
      const from = m?.from;
      const to = m?.to;
      if (!from || !to) continue;
      if (!map.has(from)) map.set(from, new Set<string>());
      map.get(from)!.add(to);
    }
    return map;
  }, [legalMoves]);

  const legalDestSet = useMemo(() => {
    if (!selectedFrom) return new Set<string>();
    return legalToByFrom.get(selectedFrom) || new Set<string>();
  }, [selectedFrom, legalToByFrom]);

  const activeSide = fenBoard?.activeColor || "w";

  const algebraFromRC = (r: number, c: number) => {
    const file = String.fromCharCode("a".charCodeAt(0) + c);
    const rank = String(8 - r);
    return `${file}${rank}`;
  };

  const pieceToSymbol: Record<string, string> = {
    P: "♙",
    p: "♟",
    N: "♘",
    n: "♞",
    B: "♗",
    b: "♝",
    R: "♖",
    r: "♜",
    Q: "♕",
    q: "♛",
    K: "♔",
    k: "♚",
  };

  const submitUci = async (rawUci: string) => {
    if (!gameId) return;
    const raw = rawUci.trim();
    if (!raw) return;

    try {
      setAddingMove(true);
      setGameErr(null);

      const res = await fetch(
        `${API_BASE}/api/cyberchess/games/${gameId}/moves`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uci: raw }),
        }
      );

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.details || "Ошибка добавления хода");
      }

      await loadGame(gameId);
    } catch (e: any) {
      setGameErr(e?.message || "Ошибка добавления хода");
    } finally {
      setAddingMove(false);
    }
  };

  const loadPlayers = async () => {
    try {
      setLoadingPlayers(true);
      setPlayersErr(null);

      const res = await fetch(`${API_BASE}/api/cyberchess/players`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки игроков");
      setPlayers((data?.items || []) as CyberPlayer[]);
    } catch (e: any) {
      setPlayersErr(e?.message || "Ошибка загрузки игроков");
    } finally {
      setLoadingPlayers(false);
    }
  };

  const loadGame = async (id: string) => {
    try {
      setLoadingGame(true);
      setGameErr(null);
      const res = await fetch(`${API_BASE}/api/cyberchess/games/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Ошибка загрузки игры");
      setGame((data?.game || null) as CyberGame | null);
      setMoves((data?.moves || []) as CyberMove[]);
    } catch (e: any) {
      setGameErr(e?.message || "Ошибка загрузки игры");
    } finally {
      setLoadingGame(false);
    }
  };

  useEffect(() => {
    loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!players.length) return;
    if (!whiteId) setWhiteId(players[0].id);
    if (!blackId && players[1]) setBlackId(players[1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  const canCreatePlayer = useMemo(() => {
    return Boolean(newPlayerName.trim());
  }, [newPlayerName]);

  const createPlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreatePlayer) return;

    const name = newPlayerName.trim();
    setPlayersErr(null);

    const res = await fetch(`${API_BASE}/api/cyberchess/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setPlayersErr(data?.error || data?.details || "Ошибка создания игрока");
      return;
    }

    setNewPlayerName("");
    await loadPlayers();
  };

  const createGame = async () => {
    if (!whiteId || !blackId) {
      setGameErr("Выбери White и Black");
      return;
    }
    if (whiteId === blackId) {
      setGameErr("White и Black не должны совпадать");
      return;
    }

    setGameErr(null);
    setGameId(null);
    setGame(null);
    setMoves([]);

    const res = await fetch(`${API_BASE}/api/cyberchess/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whitePlayerId: whiteId, blackPlayerId: blackId }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setGameErr(data?.error || "Ошибка создания игры");
      return;
    }

    const id = data?.id as string;
    setGameId(id);
    await loadGame(id);
  };

  const addMove = async () => {
    if (!uciMove.trim()) {
      setGameErr("Введите uci (например e2e4)");
      return;
    }
    await submitUci(uciMove);
  };

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, marginBottom: 6 }}>CyberChess</h1>
          <p style={{ color: "#666", marginTop: 0 }}>
            MVP: игроки, игры, запись ходов и состояние (FEN).
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/" style={{ color: "#0a5" }}>
            Globus
          </Link>
        </div>
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 14,
          marginTop: 18,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>1) Игроки</h2>

        {playersErr ? (
          <div style={{ color: "crimson", marginBottom: 10 }}>{playersErr}</div>
        ) : null}

        <form onSubmit={createPlayer} style={{ display: "grid", gap: 10 }}>
          <input
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Имя игрока (например Alice)"
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />
          <button
            type="submit"
            disabled={!canCreatePlayer || loadingPlayers}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #111",
              background: !canCreatePlayer || loadingPlayers ? "#888" : "#111",
              color: "#fff",
              width: 220,
            }}
          >
            Создать игрока
          </button>
        </form>

        <div style={{ marginTop: 12 }}>
          <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
            Список игроков ({players.length})
          </div>
          {loadingPlayers ? (
            <div>Загрузка…</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                    id: <span style={{ fontFamily: "monospace" }}>{p.id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 14,
          marginTop: 18,
        }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>2) Игра</h2>

        {gameErr ? (
          <div style={{ color: "crimson", marginBottom: 10 }}>{gameErr}</div>
        ) : null}

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>White</div>
            <select
              value={whiteId}
              onChange={(e) => setWhiteId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">—</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>Black</div>
            <select
              value={blackId}
              onChange={(e) => setBlackId(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
            >
              <option value="">—</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            onClick={createGame}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #0a5",
              background: "#0a5",
              color: "#fff",
              width: 220,
            }}
          >
            Создать игру
          </button>
        </div>

        {gameId ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ color: "#666", fontSize: 13, marginBottom: 8 }}>
              Game id: <span style={{ fontFamily: "monospace" }}>{gameId}</span>
            </div>

            {loadingGame ? (
              <div>Загрузка игры…</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "320px 1fr",
                    gap: 14,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 10,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Доска</div>
                    <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
                      Клик: выбери From → затем To (поддержка promotion: по умолчанию `q`).
                    </div>

                    {fenBoard ? (
                      <div
                        style={{
                          width: 300,
                          height: 300,
                          display: "grid",
                          gridTemplateColumns: "repeat(8, 1fr)",
                          borderRadius: 10,
                          overflow: "hidden",
                          boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
                        }}
                      >
                        {fenBoard.board.map((row, r) =>
                          row.map((piece, c) => {
                            const isDark = (r + c) % 2 === 1;
                            const bg = isDark ? "#b58863" : "#f0d9b5";
                            const square = algebraFromRC(r, c);
                            const isSelected = selectedFrom === square;
                            const isLegalDest =
                              selectedFrom && legalDestSet.has(square);
                            const isActivePiece = piece
                              ? (piece === piece.toUpperCase() ? "w" : "b") === activeSide
                              : false;
                    const isLastFrom = lastFromTo?.from === square;
                    const isLastTo = lastFromTo?.to === square;
                            return (
                              <button
                                key={square}
                                type="button"
                                onClick={() => {
                                  // Проверяем выбор "From" по активной стороне хода.
                                  if (!piece) {
                                    if (!selectedFrom) return;
                                    // если кликнули по пустой клетке после выбора From
                                    if (!legalDestSet.has(square)) {
                                      setGameErr(
                                        "Нелегальный ход. Выбирай подсвеченную клетку."
                                      );
                                      return;
                                    }
                                    const uci = `${selectedFrom}${square}`;
                                    const p = selectedPiece || "";
                                    const isPawn = p.toLowerCase() === "p";
                                    const toRank = Number(square[1]);
                                    const shouldPromote =
                                      isPawn && (toRank === 8 || toRank === 1);
                                    const uciFinal = shouldPromote ? `${uci}q` : uci;
                                    setSelectedFrom(null);
                                    setSelectedPiece(null);
                                    setGameErr(null);
                                    submitUci(uciFinal);
                                    return;
                                  }

                                  if (!selectedFrom) {
                                    if (!isActivePiece) {
                                      setGameErr(
                                        `Сейчас ход: ${
                                          activeSide === "w" ? "белых" : "чёрных"
                                        }. Выберите фигуру нужного цвета.`
                                      );
                                      return;
                                    }
                                    setSelectedFrom(square);
                                    setSelectedPiece(piece);
                                    setGameErr(null);
                                    return;
                                  }

                                  // Second click = To
                                  if (!legalDestSet.has(square)) {
                                    setGameErr(
                                      "Нелегальный ход. Выбирай подсвеченную клетку."
                                    );
                                    return;
                                  }
                                  const uciBase = `${selectedFrom}${square}`;
                                  const isPawn = (selectedPiece || "").toLowerCase() === "p";
                                  const toRank = Number(square[1]);
                                  const shouldPromote =
                                    isPawn && (toRank === 8 || toRank === 1);
                                  const uciFinal = shouldPromote
                                    ? `${uciBase}q`
                                    : uciBase;

                                  setSelectedFrom(null);
                                  setSelectedPiece(null);
                                  setGameErr(null);
                                  submitUci(uciFinal);
                                }}
                                style={{
                                  padding: 0,
                                  border: "none",
                                  width: "100%",
                                  height: "100%",
                                  background: bg,
                                  cursor: "pointer",
                                  borderRadius: 0,
                                  boxShadow: isSelected
                                    ? "inset 0 0 0 3px rgba(0,170,85,0.95)"
                                    : isLastTo
                                      ? "inset 0 0 0 3px rgba(255,90,0,0.55), 0 0 18px rgba(255,90,0,0.18)"
                                      : isLastFrom
                                        ? "inset 0 0 0 3px rgba(255,215,0,0.55)"
                                    : isLegalDest
                                      ? "inset 0 0 0 3px rgba(0,120,255,0.35)"
                                      : isActivePiece
                                        ? "inset 0 0 0 2px rgba(0,170,85,0.18)"
                                        : "none",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 26,
                                  lineHeight: 1,
                                  fontWeight: 800,
                                  color: piece
                                    ? piece === piece.toUpperCase()
                                      ? "#f9fafb"
                                      : "#111827"
                                    : "#111827",
                                  textShadow: piece
                                    ? piece === piece.toUpperCase()
                                      ? isDark
                                        ? "0 1px 0 rgba(0,0,0,0.45), 0 3px 10px rgba(0,0,0,0.25)"
                                        : "0 1px 0 rgba(0,0,0,0.35), 0 3px 10px rgba(0,0,0,0.18)"
                                      : isDark
                                        ? "0 1px 0 rgba(255,255,255,0.22), 0 3px 10px rgba(255,255,255,0.12)"
                                        : "0 1px 0 rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.18)"
                                    : "none",
                                }}
                                title={square}
                              >
                                {piece ? pieceToSymbol[piece] : ""}
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div style={{ color: "#666" }}>FEN недоступен</div>
                    )}

                    <div style={{ marginTop: 10, color: "#666", fontSize: 12 }}>
                      Активный ход: <b>{fenBoard?.activeColor === "w" ? "Белые" : "Чёрные"}</b>
                    </div>
                    {lastFromTo ? (
                      <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>
                        Последний ход:{" "}
                        <b style={{ fontFamily: "monospace" }}>
                          {lastFromTo.from} → {lastFromTo.to}
                        </b>
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 800 }}>Статус: {game?.status || "—"}</div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                    FEN:
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 6, wordBreak: "break-all" }}>
                    {game?.fen || "—"}
                  </div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Добавить ход</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      value={uciMove}
                      onChange={(e) => setUciMove(e.target.value)}
                      placeholder="uci (например e2e4)"
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid #ccc",
                        flex: "1 1 220px",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addMove}
                      disabled={addingMove}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #111",
                        background: addingMove ? "#888" : "#111",
                        color: "#fff",
                        width: 220,
                        cursor: addingMove ? "not-allowed" : "pointer",
                      }}
                    >
                      {addingMove ? "Добавляем..." : "Отправить ход"}
                    </button>
                  </div>
                  <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
                    Поддерживается `uci` (например `e2e4`, `e7e8q`).
                  </div>
                </div>

                <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, background: "#fff" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>
                    Ходы ({moves.length})
                  </div>
                  {moves.length === 0 ? (
                    <div style={{ color: "#666" }}>Пока нет ходов.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {moves.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            border: "1px solid #f2f2f2",
                            borderRadius: 10,
                            padding: 10,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 800 }}>
                              ply #{m.ply}
                            </div>
                            <div style={{ color: "#666", fontSize: 12 }}>
                              {new Date(m.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 12, color: "#666" }}>
                            uci: {m.uci || "—"}
                          </div>
                          <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12, color: "#666" }}>
                            san: {m.san || "—"}
                          </div>
                          {m.fenAfter ? (
                            <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 11, color: "#999", wordBreak: "break-all" }}>
                              fenAfter: {m.fenAfter}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                  </div>
              </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 14, color: "#666", fontSize: 13 }}>
            Создай игру, чтобы начать записывать ходы.
          </div>
        )}
      </section>
    </main>
  );
}

